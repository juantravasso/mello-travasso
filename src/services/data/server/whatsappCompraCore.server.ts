import "server-only";
import { prisma } from "@/lib/prisma";
import { obterRecursosDaEmpresa, obterStatusPlano, perfilObrigatorioPendente } from "@/lib/auth/acessoEmpresa.server";
import { verificarLimite } from "@/lib/auth/limite";
import { ACESSO, normalizarModulos, temAlgumModulo, TODOS_OS_MODULOS } from "@/lib/auth/modulos";
import { dataLocal } from "@/lib/calendario/tempo";
import { formatarNumeroCompra } from "@/lib/compras";
import { urlDoSite } from "@/lib/rede/site";
import { MIMES_DE_FOTO, montarRascunhoDaFoto, RESPOSTAS_FOTO, TAMANHO_MAX_FOTO_BYTES, textoDoRascunho } from "@/lib/whatsapp/compraPorFoto";
import type { MidiaBaixada } from "@/lib/whatsapp/cliente.server";
import type { MensagemRecebida } from "@/lib/whatsapp/vinculo";
import type { ResultadoExtracao, SolicitacaoExtracao } from "@/types";
import { salvarCompra, sugerirIdentificacao } from "./comprasCore.server";
import { garantirDeposito } from "./depositoCore.server";
import { registrarEvento } from "./eventosCore.server";

// Foto da nota pelo WhatsApp → rascunho de compra no Depósito. Mesmas barreiras do site (plano com gestão, módulo de
// captura, perfil publicado, fora do somente leitura, limite de leituras por hora) e a MESMA gravação (salvarCompra).
// Nunca efetiva: a pessoa confere e efetiva no app. As dependências externas (baixar, ler com IA, responder) entram
// por parâmetro para o teste de integração rodar sem WhatsApp e sem IA.

/** Mesmo limite da leitura pelo site: as duas contam juntas por empresa. */
const LIMITE_POR_HORA = 30;

export interface DependenciasFoto {
  baixar: (mensagem: MensagemRecebida, limiteBytes: number) => Promise<MidiaBaixada>;
  extrair: (solicitacao: SolicitacaoExtracao) => Promise<ResultadoExtracao>;
  responder: (chatId: string, texto: string) => Promise<void>;
}

export type DesfechoFoto =
  | "nao_vinculado"
  | "sem_acesso"
  | "somente_leitura"
  | "repetida"
  | "limite"
  | "formato"
  | "nao_leu"
  | "rascunho"
  | "falha";

interface Autor {
  usuarioId: string;
  nome: string;
  empresaId: string;
  fusoHorario: string;
}

async function autorizar(chatId: string): Promise<Autor | Exclude<DesfechoFoto, "rascunho">> {
  const vinculo = await prisma.vinculoWhatsapp.findUnique({
    where: { chatId },
    include: { usuario: { include: { empresa: { select: { bloqueadaEm: true, fusoHorario: true } } } } },
  });
  if (!vinculo?.verificadoEm) return "nao_vinculado";
  const u = vinculo.usuario;
  if (u.bloqueadoPlataformaEm || u.desativadoEm || u.empresa.bloqueadaEm || u.trocarSenha) return "sem_acesso";

  const pessoa = { papel: u.papel, modulos: u.papel === "dono" ? TODOS_OS_MODULOS : normalizarModulos(u.modulos) };
  const recursos = await obterRecursosDaEmpresa(u.empresaId);
  if (!recursos.has("gestao") || !temAlgumModulo(pessoa, ACESSO.leituraDeComprovante)) return "sem_acesso";
  if (await perfilObrigatorioPendente(u.empresaId, u.papel, u.papelPlataforma === "admin")) return "sem_acesso";
  if ((await obterStatusPlano(u.empresaId)).somenteLeitura) return "somente_leitura";
  return { usuarioId: u.id, nome: u.nome, empresaId: u.empresaId, fusoHorario: u.empresa.fusoHorario };
}

// Número não vinculado NÃO recebe resposta do robô: pode ser alguém falando com o suporte (que é feito por pessoas).
const RESPOSTA_DO_DESFECHO: Partial<Record<DesfechoFoto, string>> = {
  sem_acesso: RESPOSTAS_FOTO.semAcesso,
  somente_leitura: RESPOSTAS_FOTO.somenteLeitura,
  limite: RESPOSTAS_FOTO.limite,
  formato: RESPOSTAS_FOTO.formato,
  nao_leu: RESPOSTAS_FOTO.naoLeu,
  falha: RESPOSTAS_FOTO.falha,
};

/** Trata uma mensagem com mídia. Devolve o desfecho (para teste e log); a resposta à pessoa já foi enviada. */
export async function processarFotoRecebida(mensagem: MensagemRecebida, deps: DependenciasFoto): Promise<DesfechoFoto> {
  const responder = (texto: string) => deps.responder(mensagem.chatId, texto).catch(() => console.error("[whatsapp/foto] resposta não enviada"));

  const autor = await autorizar(mensagem.chatId);
  if (typeof autor === "string") {
    const texto = RESPOSTA_DO_DESFECHO[autor];
    if (texto) await responder(texto);
    return autor;
  }

  // O mesmo webhook pode chegar duas vezes (o WAHA reenvia): a foto só é lida uma vez.
  if (mensagem.mensagemId) {
    const nova = await registrarEvento(prisma, {
      tipo: "whatsapp_foto_recebida",
      empresaId: autor.empresaId,
      usuarioId: autor.usuarioId,
      chave: `whatsapp_foto:${mensagem.mensagemId}`,
    });
    if (!nova) return "repetida";
  }

  if (mensagem.midia?.tipo !== "imagem") {
    await responder(RESPOSTAS_FOTO.formato);
    return "formato";
  }

  const limite = await verificarLimite(`ia-extract:${autor.empresaId}`, LIMITE_POR_HORA, 60 * 60 * 1000);
  if (!limite.permitido) {
    await responder(RESPOSTAS_FOTO.limite);
    return "limite";
  }

  try {
    let midia: MidiaBaixada;
    try {
      midia = await deps.baixar(mensagem, TAMANHO_MAX_FOTO_BYTES);
    } catch (erro) {
      if (erro instanceof Error && "status" in erro && erro.status === 413) {
        await responder(RESPOSTAS_FOTO.formato);
        return "formato";
      }
      throw erro;
    }
    if (!MIMES_DE_FOTO.has(midia.mimetype) || midia.bytes > TAMANHO_MAX_FOTO_BYTES) {
      await responder(RESPOSTAS_FOTO.formato);
      return "formato";
    }

    await responder(RESPOSTAS_FOTO.lendo);
    const leitura = await deps.extrair({ imagemBase64: midia.base64, mimeType: midia.mimetype as SolicitacaoExtracao["mimeType"] });
    const destinoId = await garantirDeposito(autor.empresaId);
    const entrada =
      leitura.sucesso && leitura.dados && leitura.dados.confiancaExtracao > 0
        ? montarRascunhoDaFoto(leitura.dados, { destinoId, hoje: dataLocal(new Date(), autor.fusoHorario), fotoDataUrl: `data:${midia.mimetype};base64,${midia.base64}` })
        : null;
    if (!entrada) {
      await responder(RESPOSTAS_FOTO.naoLeu);
      return "nao_leu";
    }

    // Identifica só pelo que é seguro (memória do fornecedor ou nome igual); o "parecido" fica para a pessoa decidir.
    const ctx = { empresaId: autor.empresaId, nome: autor.nome };
    const sugestoes = await sugerirIdentificacao(ctx, { fornecedorNome: entrada.fornecedorNome, itens: entrada.itens.map((i) => ({ descricao: i.descricao })) });
    entrada.itens = entrada.itens.map((item, i) => {
      const s = sugestoes[i];
      return s && s.motivo !== "parecido" ? { ...item, produtoId: s.produtoId } : item;
    });

    const compra = await salvarCompra(ctx, entrada);
    const total = Math.round(entrada.itens.reduce((soma, i) => soma + i.valorTotal, 0) * 100) / 100;
    await registrarEvento(prisma, { tipo: "whatsapp_compra_rascunho", empresaId: autor.empresaId, usuarioId: autor.usuarioId, chave: `whatsapp_compra:${compra.id}` });
    await responder(
      textoDoRascunho({
        numero: formatarNumeroCompra(compra.numero),
        fornecedor: entrada.fornecedorNome,
        qtdItens: entrada.itens.length,
        total,
        destino: "Depósito",
        identificados: entrada.itens.filter((i) => i.produtoId).length,
        link: `${urlDoSite()}/compras/${compra.id}`,
      }),
    );
    return "rascunho";
  } catch (erro) {
    console.error("[whatsapp/foto] falha:", erro instanceof Error ? erro.name : "erro");
    await responder(RESPOSTAS_FOTO.falha);
    return "falha";
  }
}
