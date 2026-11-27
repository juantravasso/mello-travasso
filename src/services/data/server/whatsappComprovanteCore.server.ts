import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { urlDoSite } from "@/lib/rede/site";
import { RESPOSTAS_FOTO } from "@/lib/whatsapp/compraPorFoto";
import {
  descricaoDaConta,
  ehCancelar,
  lerEscolha,
  MAX_PROJETOS_NA_LISTA,
  OPCOES_CATEGORIA,
  TEXTOS_COMPROVANTE,
  textoContaLancada,
  textoEscolhaInvalida,
  textoPerguntaCategoria,
  textoPerguntaProjeto,
  VALIDADE_PENDENCIA_HORAS,
  type DadosComprovante,
} from "@/lib/whatsapp/comprovante";
import { ehNao, ehSim } from "@/lib/whatsapp/assistente";
import type { MensagemRecebida } from "@/lib/whatsapp/vinculo";
import { registrarCaptura } from "./capturaCore.server";
import { registrarEvento } from "./eventosCore.server";
import { autorizarChat, type AutorWhatsapp } from "./whatsappAutor.server";

// Comprovante (Pix, transferência) pelo WhatsApp: guarda o que a IA leu numa pendência, pergunta do que se trata e, com
// mais de um projeto, para qual projeto vai; então lança a conta a pagar pela MESMA gravação da captura do site
// (registrarCaptura), com a foto como comprovante. Uma pendência por usuário; vale 24 h.

type Responder = (texto: string) => Promise<unknown>;

export type DesfechoPendencia = "sem_pendencia" | "ignorada" | "cancelado" | "pergunta" | "invalida" | "expirado" | "lancado" | "negado" | "sem_projeto" | "falha";

function lerDados(json: Prisma.JsonValue): DadosComprovante {
  return json as unknown as DadosComprovante;
}

/** Começa a conversa: grava a pendência (substitui uma anterior) e devolve a pergunta de categoria. null = sem valor legível. */
export async function iniciarComprovante(autor: AutorWhatsapp, dados: DadosComprovante, fotoDataUrl: string, agora: Date = new Date()): Promise<string | null> {
  if (!(dados.valor > 0)) return null;
  const iso = agora.toISOString();
  const expiraEm = new Date(agora.getTime() + VALIDADE_PENDENCIA_HORAS * 3_600_000).toISOString();
  const valor = { etapa: "categoria", dados: dados as unknown as Prisma.InputJsonValue, fotoDataUrl, expiraEm, atualizadoEm: iso };
  await prisma.pendenciaWhatsapp.upsert({
    where: { usuarioId: autor.usuarioId },
    create: { usuarioId: autor.usuarioId, empresaId: autor.empresaId, criadoEm: iso, ...valor },
    update: { empresaId: autor.empresaId, ...valor },
  });
  return textoPerguntaCategoria(dados);
}

async function projetosAtivos(empresaId: string) {
  return prisma.obra.findMany({
    where: { empresaId, ehDeposito: false, status: { in: ["em_andamento", "pausada"] } },
    orderBy: { atualizadoEm: "desc" },
    take: MAX_PROJETOS_NA_LISTA,
    select: { id: true, nome: true },
  });
}

async function lancar(autor: AutorWhatsapp, pendenciaId: string, dados: DadosComprovante, fotoDataUrl: string, projeto: { id: string; nome: string }, responder: Responder): Promise<DesfechoPendencia> {
  // Consome a pendência ANTES de lançar: duas respostas iguais ao mesmo tempo lançam uma conta só.
  const consumida = await prisma.pendenciaWhatsapp.deleteMany({ where: { id: pendenciaId } });
  if (consumida.count === 0) return "sem_pendencia";
  const resultado = await registrarCaptura(
    { empresaId: autor.empresaId, nome: autor.nome },
    {
      tipoDocumento: "comprovante",
      obraId: projeto.id,
      valor: dados.valor,
      data: dados.data,
      favorecido: dados.favorecido.slice(0, 200),
      descricao: descricaoDaConta(dados),
      categoria: dados.categoria,
      formaPagamento: "pix",
      observacao: "Lançada pelo comprovante enviado no WhatsApp.",
      comprovanteUrl: fotoDataUrl,
      itens: [],
    },
  );
  const conta = await prisma.contaFinanceira.findUnique({ where: { id: resultado.contaId }, select: { status: true } });
  await registrarEvento(prisma, { tipo: "whatsapp_comprovante_lancado", empresaId: autor.empresaId, usuarioId: autor.usuarioId, chave: `whatsapp_comprovante:${resultado.contaId}` });
  await responder(textoContaLancada({ ...dados, projeto: projeto.nome, baixada: conta?.status === "baixada", link: `${urlDoSite()}/contas-a-pagar/${resultado.contaId}` }));
  return "lancado";
}

const NEGADO: Record<string, string> = { sem_acesso: RESPOSTAS_FOTO.semAcesso, somente_leitura: RESPOSTAS_FOTO.somenteLeitura };

/**
 * Trata uma mensagem de texto de quem tem pergunta em aberto. Sem pendência, não faz nada (a conversa é do suporte). Com
 * pendência, reage a número e a CANCELAR; texto livre devolve "ignorada" (vai para o assistente).
 */
export async function responderPendencia(mensagem: MensagemRecebida, enviar: (chatId: string, texto: string) => Promise<void>, agora: Date = new Date()): Promise<DesfechoPendencia> {
  const responder: Responder = (texto) => enviar(mensagem.chatId, texto).catch(() => console.error("[whatsapp/comprovante] resposta não enviada"));
  const vinculo = await prisma.vinculoWhatsapp.findUnique({ where: { chatId: mensagem.chatId }, select: { usuarioId: true, verificadoEm: true } });
  if (!vinculo?.verificadoEm) return "sem_pendencia";
  const pendencia = await prisma.pendenciaWhatsapp.findUnique({ where: { usuarioId: vinculo.usuarioId } });
  if (!pendencia) return "sem_pendencia";

  const dados = lerDados(pendencia.dados);
  const max = pendencia.etapa === "projeto" ? (dados.projetos?.length ?? 0) : OPCOES_CATEGORIA.length;
  const escolha = lerEscolha(mensagem.texto, max);
  const cancelar = ehCancelar(mensagem.texto);
  const pareceResposta = cancelar || /^\s*(?:op[cç][aã]o\s*)?\d{1,2}\s*[.)\-]?\s*$/i.test(mensagem.texto);

  if (pendencia.expiraEm <= agora.toISOString()) {
    await prisma.pendenciaWhatsapp.deleteMany({ where: { id: pendencia.id } });
    if (pareceResposta) await responder(TEXTOS_COMPROVANTE.expirado);
    return "expirado";
  }
  if (cancelar) {
    await prisma.pendenciaWhatsapp.deleteMany({ where: { id: pendencia.id } });
    await responder(TEXTOS_COMPROVANTE.cancelado);
    return "cancelado";
  }
  if (escolha === null) {
    // Texto livre no meio da pergunta: pode ser conversa com o suporte. Só avisa quando parece uma tentativa de resposta.
    // Conversa livre (não parece resposta), ou SIM/NÃO de uma operação do assistente: fica para o assistente, e a
    // pergunta do comprovante segue em aberto.
    if ((!pareceResposta && mensagem.texto.trim().length > 3) || ehSim(mensagem.texto) || ehNao(mensagem.texto)) return "ignorada";
    await responder(textoEscolhaInvalida(max));
    return "invalida";
  }

  const autor = await autorizarChat(mensagem.chatId);
  if (typeof autor === "string") {
    await prisma.pendenciaWhatsapp.deleteMany({ where: { id: pendencia.id } });
    if (NEGADO[autor]) await responder(NEGADO[autor]);
    return "negado";
  }

  try {
    if (pendencia.etapa === "categoria") {
      const opcao = OPCOES_CATEGORIA[escolha - 1];
      const comCategoria: DadosComprovante = { ...dados, categoria: opcao.categoria, rotuloCategoria: opcao.rotulo };
      const projetos = await projetosAtivos(autor.empresaId);
      if (projetos.length === 0) {
        await prisma.pendenciaWhatsapp.deleteMany({ where: { id: pendencia.id } });
        await responder(TEXTOS_COMPROVANTE.semProjeto);
        return "sem_projeto";
      }
      if (projetos.length === 1) return await lancar(autor, pendencia.id, comCategoria, pendencia.fotoDataUrl, projetos[0], responder);
      await prisma.pendenciaWhatsapp.update({
        where: { id: pendencia.id },
        data: { etapa: "projeto", dados: { ...comCategoria, projetos } as unknown as Prisma.InputJsonValue, atualizadoEm: agora.toISOString() },
      });
      await responder(textoPerguntaProjeto(projetos));
      return "pergunta";
    }

    const escolhido = dados.projetos?.[escolha - 1];
    // O projeto escolhido precisa continuar sendo da empresa (pode ter sido apagado no meio da conversa).
    const projeto = escolhido ? await prisma.obra.findFirst({ where: { id: escolhido.id, empresaId: autor.empresaId, ehDeposito: false }, select: { id: true, nome: true } }) : null;
    if (!projeto) {
      await prisma.pendenciaWhatsapp.deleteMany({ where: { id: pendencia.id } });
      await responder(TEXTOS_COMPROVANTE.expirado);
      return "expirado";
    }
    return await lancar(autor, pendencia.id, dados, pendencia.fotoDataUrl, projeto, responder);
  } catch (erro) {
    console.error("[whatsapp/comprovante] falha:", erro instanceof Error ? erro.name : "erro");
    await responder(RESPOSTAS_FOTO.falha);
    return "falha";
  }
}
