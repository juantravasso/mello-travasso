import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { detectarTipoImagem } from "./armazenamento.server";
import { criarNotificacao } from "./avaliacaoCore.server";
import { apagarBytesDeDocumentos } from "./documentoLimpeza.server";
import { ErroDeNegocio } from "./resultado.server";

// Regras compartilhadas dos pedidos de verificação (selo de empresa, reivindicação
// de perfil indicado, relação comprovada). Nada é verificado nem vinculado sem a
// decisão de uma pessoa da administração; os documentos só existem enquanto o
// pedido está pendente.

export const MAX_DOCUMENTOS_POR_PEDIDO = 3;
export const TAMANHO_MAXIMO_DOCUMENTO_BYTES = 4 * 1024 * 1024;
export const MAX_PEDIDOS_ABERTOS_POR_EMPRESA = 5;
export const PRAZO_PEDIDO_PENDENTE_DIAS = 30;
/** Pedido sem nenhum documento depois disso expira: não ocupa a fila da administração. */
const PRAZO_PEDIDO_SEM_DOCUMENTO_HORAS = 24;

export type TipoDocumento = "application/pdf" | "image/jpeg" | "image/png" | "image/webp";

/** PDF pelo cabeçalho, imagem pelos bytes mágicos. O que o cliente declarou não vale. */
export function detectarTipoDocumento(bytes: Uint8Array): TipoDocumento | null {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) {
    return "application/pdf";
  }
  return detectarTipoImagem(bytes);
}

// Nomes de PDF que executam algo ou escondem conteúdo ativo. É uma heurística (um PDF com fluxos
// comprimidos pode esconder as chaves), então não substitui abrir o arquivo num visualizador isolado.
const PDF_ATIVO = /\/(JavaScript|JS|Launch|OpenAction|AA|EmbeddedFile|XFA|RichMedia|SubmitForm|Encrypt)\b/;

/** true se o PDF traz, de forma legível, qualquer dos marcadores de conteúdo ativo. */
export function pdfTemConteudoAtivo(bytes: Uint8Array): boolean {
  return PDF_ATIVO.test(Buffer.from(bytes).toString("latin1"));
}

/** Trava a linha da empresa até o fim da transação: serializa os pedidos dela (limites valem sob concorrência). */
export async function travarEmpresa(tx: Prisma.TransactionClient, empresaId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "Empresa" WHERE "id" = ${empresaId} FOR UPDATE`;
}

/**
 * Trava a linha de um pedido que ainda está pendente. Decisão, cancelamento e envio de documento usam
 * o mesmo lock: ou o documento entra antes da decisão (e é apagado com ela) ou encontra o pedido já
 * decidido e é recusado. Devolve false se o pedido não existe ou não está mais pendente.
 */
export async function travarPedidoPendente(tx: Prisma.TransactionClient, pedidoId: string): Promise<boolean> {
  const linhas = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "SolicitacaoVerificacao" WHERE "id" = ${pedidoId} AND "status" = 'pendente' FOR UPDATE
  `;
  return linhas.length > 0;
}

/** Apaga os bytes dos documentos (a linha fica, vazia, como registro de que existiu). */
export async function apagarDocumentos(tx: Prisma.TransactionClient, solicitacaoIds: string[]): Promise<void> {
  if (solicitacaoIds.length === 0) return;
  await apagarBytesDeDocumentos(tx, { solicitacaoId: { in: solicitacaoIds } });
}

/**
 * Limpeza oportunista da retenção: pedidos pendentes há mais de 30 dias (ou há mais de 24 h sem
 * nenhum documento) expiram e perdem os arquivos, e qualquer documento que sobrou de pedido já
 * decidido (envio concorrente) é apagado. Não guardamos dado sensível de quem não foi analisado.
 */
export async function expirarPedidosAntigos(): Promise<void> {
  const agoraMs = Date.now();
  const limite30d = new Date(agoraMs - PRAZO_PEDIDO_PENDENTE_DIAS * 24 * 60 * 60 * 1000).toISOString();
  const limiteSemDoc = new Date(agoraMs - PRAZO_PEDIDO_SEM_DOCUMENTO_HORAS * 60 * 60 * 1000).toISOString();
  const [velhos, vazios] = await Promise.all([
    prisma.solicitacaoVerificacao.findMany({ where: { status: "pendente", criadoEm: { lt: limite30d } }, select: { id: true }, take: 100 }),
    prisma.solicitacaoVerificacao.findMany({
      where: { status: "pendente", criadoEm: { lt: limiteSemDoc }, documentos: { none: { apagadoEm: null } } },
      select: { id: true },
      take: 100,
    }),
  ]);
  const agora = new Date().toISOString();
  await prisma.$transaction(async (tx) => {
    if (velhos.length > 0) {
      await tx.solicitacaoVerificacao.updateMany({
        where: { id: { in: velhos.map((v) => v.id) }, status: "pendente" },
        data: { status: "expirada", atualizadoEm: agora, decididaEm: agora, motivoDecisao: "Sem análise em 30 dias; os documentos foram apagados. Envie um novo pedido." },
      });
      await apagarDocumentos(tx, velhos.map((v) => v.id));
    }
    if (vazios.length > 0) {
      await tx.solicitacaoVerificacao.updateMany({
        where: { id: { in: vazios.map((v) => v.id) }, status: "pendente" },
        data: { status: "expirada", atualizadoEm: agora, decididaEm: agora, motivoDecisao: "O pedido ficou sem documento por mais de 24 horas. Envie um novo pedido com o documento." },
      });
    }
    // Sobras: documento ainda guardado de pedido que já não está pendente.
    await apagarBytesDeDocumentos(tx, { solicitacao: { status: { not: "pendente" } } });
  });
}

interface SolicitacaoParaAplicar {
  id: string;
  tipo: "empresa_verificada" | "reivindicacao_perfil" | "relacao_comprovada";
  solicitanteEmpresaId: string;
  perfilId: string | null;
  avaliacaoId: string | null;
}

export interface EfeitoAprovacao {
  /** Vai para o LogAdmin: o suficiente para entender (e desfazer) o que a aprovação mudou. */
  resumo: Prisma.InputJsonObject;
  textoNotificacao: string;
  href: string;
}

/**
 * Efeito de uma aprovação, dentro da transação da decisão. Cada tipo reconfere
 * as condições no momento de aprovar (o mundo pode ter mudado desde o pedido).
 */
export async function aplicarAprovacao(tx: Prisma.TransactionClient, solicitacao: SolicitacaoParaAplicar, agora: string): Promise<EfeitoAprovacao> {
  const empresa = await tx.empresa.findUnique({
    where: { id: solicitacao.solicitanteEmpresaId },
    select: { id: true, documento: true, tipoPessoa: true, bloqueadaEm: true, verificadaEm: true, perfilPublico: { select: { id: true, status: true } } },
  });
  if (!empresa || empresa.bloqueadaEm) throw new ErroDeNegocio("A empresa solicitante não está ativa.");

  if (solicitacao.tipo === "empresa_verificada") {
    const seloConcedido = !empresa.verificadaEm;
    if (seloConcedido) await tx.empresa.update({ where: { id: empresa.id }, data: { verificadaEm: agora, atualizadoEm: agora } });
    return {
      resumo: { seloConcedido },
      textoNotificacao: "Seu pedido de verificação foi aprovado. O selo aparece no seu perfil público.",
      href: "/minha-rede/verificacao",
    };
  }

  if (solicitacao.tipo === "relacao_comprovada") {
    const avaliacao = await tx.avaliacao.findUnique({
      where: { id: solicitacao.avaliacaoId ?? "" },
      select: { id: true, status: true, avaliadorEmpresaId: true },
    });
    if (!avaliacao || avaliacao.avaliadorEmpresaId !== empresa.id) throw new ErroDeNegocio("A avaliação não existe mais ou mudou de dono.");
    if (avaliacao.status !== "publicada") throw new ErroDeNegocio("A avaliação não está publicada.");
    await tx.avaliacao.update({ where: { id: avaliacao.id }, data: { statusVerificacao: "relacao_comprovada" } });
    return {
      resumo: { avaliacaoId: avaliacao.id },
      textoNotificacao: "A relação comercial da sua avaliação foi comprovada. Ela agora mostra o selo de relação comprovada.",
      href: "/minha-rede/avaliacoes?aba=feitas",
    };
  }

  // reivindicacao_perfil
  const perfil = await tx.perfilPublico.findUnique({
    where: { id: solicitacao.perfilId ?? "" },
    select: { id: true, slug: true, tipo: true, status: true, empresaId: true, documentoIndicado: true },
  });
  if (!perfil || perfil.status !== "indicado" || perfil.empresaId) throw new ErroDeNegocio("O perfil não está mais disponível para reivindicação.");
  if (perfil.tipo !== empresa.tipoPessoa) throw new ErroDeNegocio("O tipo do perfil (empresa ou autônomo) não confere com o do solicitante.");
  // Perfil indicado com CNPJ: só a empresa cadastrada com esse CNPJ pode ficar com ele.
  if (perfil.documentoIndicado && perfil.documentoIndicado !== empresa.documento) {
    throw new ErroDeNegocio("O CNPJ do perfil indicado não é o da empresa solicitante.");
  }
  const meu = empresa.perfilPublico;
  if (meu) {
    // O rascunho da própria empresa, sem histórico nem conteúdo, dá lugar ao perfil reivindicado. Perfil
    // com avaliações, indicações, denúncias, serviços, portfólio ou arquivos nunca é apagado por aqui.
    const [avaliacoes, indicacoes, denuncias, servicos, trabalhos, arquivos] = await Promise.all([
      tx.avaliacao.count({ where: { perfilId: meu.id } }),
      tx.indicacao.count({ where: { perfilId: meu.id } }),
      tx.denuncia.count({ where: { perfilId: meu.id } }),
      tx.servico.count({ where: { perfilId: meu.id } }),
      tx.trabalho.count({ where: { perfilId: meu.id } }),
      tx.arquivo.count({ where: { perfilId: meu.id } }),
    ]);
    if (meu.status !== "rascunho" || avaliacoes + indicacoes + denuncias + servicos + trabalhos + arquivos > 0) {
      throw new ErroDeNegocio("A empresa já tem um perfil próprio com histórico ou conteúdo (serviços, portfólio, avaliações). Resolva manualmente antes de aprovar.");
    }
    await tx.perfilPublico.delete({ where: { id: meu.id } });
  }
  // A condição vai no próprio UPDATE: dois pedidos aprovados ao mesmo tempo para o mesmo perfil não
  // passam os dois (o segundo encontra o perfil já com dono e a transação inteira volta).
  // Vira rascunho: contatos e dados só ficam públicos quando o dono revisar e publicar.
  const vinculado = await tx.perfilPublico.updateMany({
    where: { id: perfil.id, empresaId: null, status: "indicado" },
    data: { empresaId: empresa.id, status: "rascunho", atualizadoEm: agora },
  });
  if (vinculado.count !== 1) throw new ErroDeNegocio("O perfil já foi vinculado a outra empresa.");
  // O que a própria empresa deixou antes no perfil que agora é dela (nota ou recomendação a si mesma) sai.
  const avaliacoesOcultadas = await tx.avaliacao.updateMany({
    where: { perfilId: perfil.id, avaliadorEmpresaId: empresa.id, status: "publicada" },
    data: { status: "removida", atualizadoEm: agora },
  });
  const indicacoesRemovidas = await tx.indicacao.deleteMany({ where: { perfilId: perfil.id, indicadoPorEmpresaId: empresa.id } });
  // Quem comprovou o vínculo com o CNPJ ou a identidade também fica verificado.
  const seloConcedido = !empresa.verificadaEm;
  if (seloConcedido) await tx.empresa.update({ where: { id: empresa.id }, data: { verificadaEm: agora, atualizadoEm: agora } });
  return {
    resumo: {
      perfilSlug: perfil.slug,
      rascunhoSubstituido: !!meu,
      seloConcedido,
      avaliacoesOcultadas: avaliacoesOcultadas.count,
      indicacoesRemovidas: indicacoesRemovidas.count,
    },
    textoNotificacao: "Sua reivindicação foi aprovada. O perfil agora é seu: revise os dados e publique.",
    href: "/minha-rede/perfil",
  };
}

/**
 * Depois de aprovar a reivindicação de um perfil, os outros pedidos pendentes para o mesmo perfil
 * ficam sem objeto: são recusados (e perdem os documentos), com aviso a cada empresa.
 */
export async function fecharPedidosConcorrentes(
  tx: Prisma.TransactionClient,
  perfilId: string,
  pedidoAprovadoId: string,
  adminUsuarioId: string,
  agora: string,
): Promise<number> {
  const outros = await tx.solicitacaoVerificacao.findMany({
    where: { perfilId, status: "pendente", id: { not: pedidoAprovadoId } },
    select: { id: true, solicitanteEmpresaId: true },
  });
  if (outros.length === 0) return 0;
  const ids = outros.map((o) => o.id);
  await tx.solicitacaoVerificacao.updateMany({
    where: { id: { in: ids }, status: "pendente" },
    data: {
      status: "recusada",
      decididaPorUsuarioId: adminUsuarioId,
      decididaEm: agora,
      atualizadoEm: agora,
      motivoDecisao: "Outro pedido para este perfil foi aprovado. Se o perfil é seu, fale com o suporte.",
    },
  });
  await apagarDocumentos(tx, ids);
  for (const o of outros) {
    await notificarDecisao(tx, o.solicitanteEmpresaId, false, "", "/minha-rede/verificacao", "outro pedido para este perfil foi aprovado.");
  }
  return outros.length;
}

/**
 * Desfaz uma aprovação (selo concedido por engano, reivindicação contestada, comprovante falso):
 * revoga o selo, devolve o perfil à rede como indicado ou rebaixa a relação. O que a aprovação
 * ocultou (avaliações da própria empresa) não volta sozinho.
 */
export async function desfazerEfeito(
  tx: Prisma.TransactionClient,
  solicitacao: SolicitacaoParaAplicar,
  detalhesDaAprovacao: Prisma.JsonValue | null,
  agora: string,
): Promise<Prisma.InputJsonObject> {
  const detalhes = detalhesDaAprovacao && typeof detalhesDaAprovacao === "object" && !Array.isArray(detalhesDaAprovacao) ? detalhesDaAprovacao : {};
  // Só preserva o selo se o registro da aprovação diz, com todas as letras, que ela não o concedeu:
  // registro sem a informação conta como concedido (errar para menos confiança; a empresa pede de novo).
  const seloConcedido = (detalhes as Record<string, unknown>).seloConcedido !== false;

  if (solicitacao.tipo === "empresa_verificada") {
    await tx.empresa.updateMany({ where: { id: solicitacao.solicitanteEmpresaId }, data: { verificadaEm: null, atualizadoEm: agora } });
    return { seloRevogado: true };
  }
  if (solicitacao.tipo === "relacao_comprovada") {
    const avaliacao = await tx.avaliacao.findUnique({
      where: { id: solicitacao.avaliacaoId ?? "" },
      select: { id: true, statusVerificacao: true, verificacaoRelacao: { select: { estado: true } } },
    });
    if (!avaliacao) return {};
    if (avaliacao.statusVerificacao === "relacao_comprovada") {
      const volta = avaliacao.verificacaoRelacao?.estado === "confirmada" ? "relacao_confirmada" : "nao_verificada";
      await tx.avaliacao.update({ where: { id: avaliacao.id }, data: { statusVerificacao: volta } });
    }
    return { avaliacaoId: avaliacao.id };
  }
  // reivindicacao_perfil
  const devolvido = await tx.perfilPublico.updateMany({
    where: { id: solicitacao.perfilId ?? "", empresaId: solicitacao.solicitanteEmpresaId },
    data: { empresaId: null, status: "indicado", atualizadoEm: agora },
  });
  if (seloConcedido) await tx.empresa.updateMany({ where: { id: solicitacao.solicitanteEmpresaId }, data: { verificadaEm: null, atualizadoEm: agora } });
  return { perfilDevolvido: devolvido.count === 1, seloRevogado: seloConcedido };
}

/** Avisa o solicitante da decisão. */
export async function notificarDecisao(
  tx: Prisma.TransactionClient,
  empresaId: string,
  aprovada: boolean,
  textoAprovacao: string,
  hrefAprovacao: string,
  motivo: string | undefined,
): Promise<void> {
  await criarNotificacao(
    tx,
    empresaId,
    "verificacao_decidida",
    aprovada ? textoAprovacao : `Seu pedido de verificação foi recusado${motivo ? `: ${motivo}` : "."}`,
    aprovada ? hrefAprovacao : "/minha-rede/verificacao",
    { semDedupe: true },
  );
}

/** CPF aparece só em parte (padrão LGPD: 6 dígitos do meio); CNPJ é dado público e aparece completo. */
export function documentoParaAdmin(tipo: "pj" | "pf", documento: string): string {
  if (tipo === "pf") return `***.${documento.slice(3, 6)}.${documento.slice(6, 9)}-**`;
  return documento.length === 14
    ? `${documento.slice(0, 2)}.${documento.slice(2, 5)}.${documento.slice(5, 8)}/${documento.slice(8, 12)}-${documento.slice(12)}`
    : documento;
}
