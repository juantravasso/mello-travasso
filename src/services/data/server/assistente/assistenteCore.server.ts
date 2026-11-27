import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verificarLimite } from "@/lib/auth/limite";
import { MODULOS_DE_GESTAO } from "@/lib/auth/modulos";
import {
  acrescentarNaMemoria,
  agoraNoFuso,
  emAtendimentoHumano,
  HUMANO_POR_MS,
  lerMemoria,
  MAX_TEXTO_RECEBIDO,
  MEMORIA_POR_MS,
  pedeAssistente,
  pedeAtendente,
  CONFIRMACAO_POR_MS,
  ehNao,
  ehSim,
  refsRecentes,
  semAnotacoesInternas,
  TEXTOS_ASSISTENTE,
  type MensagemDaConversa,
} from "@/lib/whatsapp/assistente";
import type { MensagemRecebida } from "@/lib/whatsapp/vinculo";
import type { ModeloAssistente } from "@/services/ai/assistente.server";
import { registrarEvento } from "../eventosCore.server";
import { autorizarChat } from "../whatsappAutor.server";
import { definicaoParaIA, PedidoIncompleto, type ContaCitada, type ContextoFerramenta, type Ferramenta, type Proposta } from "./ferramentas.server";
import { INSTRUCOES_ASSISTENTE } from "./instrucoes";
import { ferramentasDaPessoa } from "./registro.server";

// Assistente do WhatsApp: a pessoa conversa em linguagem natural; a IA escolhe ferramentas da aplicação (só as que a
// pessoa pode usar), a aplicação valida e executa, e a IA escreve a resposta com o que o sistema devolveu.
// Barreiras, nesta ordem: número vinculado → atendimento humano em curso → mesma mensagem repetida → limites de uso →
// acesso (as mesmas regras do site) → cada ferramenta confere de novo o módulo e os argumentos. Tudo fica auditado.

export interface DependenciasAssistente {
  modelo: ModeloAssistente | null;
  enviar: (chatId: string, texto: string) => Promise<void>;
  agora?: () => Date;
}

export type DesfechoAssistente =
  | "vazia"
  | "nao_vinculado"
  | "humano"
  | "atendente"
  | "voltei"
  | "repetida"
  | "limite"
  | "negado"
  | "longa"
  | "sem_ia"
  | "respondida"
  | "executada"
  | "cancelada"
  | "expirada"
  | "falha";

const MAX_RODADAS = 5;
const POR_HORA_POR_PESSOA = 40;
const limiteDiarioDaEmpresa = () => {
  const n = Number(process.env.WHATSAPP_ASSISTENTE_DIA);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 300;
};

export async function conversarComAssistente(mensagem: MensagemRecebida, deps: DependenciasAssistente): Promise<DesfechoAssistente> {
  const agora = deps.agora?.() ?? new Date();
  const texto = mensagem.texto.trim();
  if (!texto) return "vazia";
  const responder = (t: string) => deps.enviar(mensagem.chatId, t).catch(() => console.error("[whatsapp/assistente] resposta não enviada"));

  // Número sem vínculo é conversa de suporte: o robô não responde nada.
  const vinculo = await prisma.vinculoWhatsapp.findUnique({
    where: { chatId: mensagem.chatId },
    select: { verificadoEm: true, usuario: { select: { id: true, empresaId: true } } },
  });
  if (!vinculo?.verificadoEm) return "nao_vinculado";
  const usuarioId = vinculo.usuario.id;
  const empresaIdDoVinculo = vinculo.usuario.empresaId;
  const conversa = await prisma.conversaWhatsapp.findUnique({ where: { usuarioId } });

  if (emAtendimentoHumano(conversa?.humanoAte, agora)) {
    if (!pedeAssistente(texto)) return "humano";
    await prisma.conversaWhatsapp.update({ where: { usuarioId }, data: { humanoAte: null, atualizadoEm: agora.toISOString() } });
    await responder(TEXTOS_ASSISTENTE.voltei);
    return "voltei";
  }
  if (pedeAtendente(texto)) {
    await marcarAtendimentoHumano(usuarioId, empresaIdDoVinculo, agora);
    await responder(TEXTOS_ASSISTENTE.atendente);
    return "atendente";
  }

  // O provedor pode entregar a mesma mensagem duas vezes: só a primeira é respondida.
  if (mensagem.mensagemId) {
    const nova = await registrarEvento(prisma, { tipo: "whatsapp_assistente_mensagem", empresaId: empresaIdDoVinculo, usuarioId, chave: `whatsapp_msg:${mensagem.mensagemId}`, agora });
    if (!nova) return "repetida";
  }

  const pessoa = await verificarLimite(`assistente:u:${usuarioId}`, POR_HORA_POR_PESSOA, 60 * 60 * 1000);
  if (!pessoa.permitido) {
    await responder(TEXTOS_ASSISTENTE.limite);
    return "limite";
  }
  const empresa = await verificarLimite(`assistente:e:${empresaIdDoVinculo}`, limiteDiarioDaEmpresa(), 24 * 60 * 60 * 1000);
  if (!empresa.permitido) {
    await responder(TEXTOS_ASSISTENTE.limiteEmpresa);
    return "limite";
  }

  // Consultas valem mesmo com a conta em somente leitura (teste vencido); lançamentos (etapa 3) não.
  const autor = await autorizarChat(mensagem.chatId, { modulos: MODULOS_DE_GESTAO, permitirSomenteLeitura: true });
  if (typeof autor === "string") {
    if (autor !== "nao_vinculado") await responder(autor === "suspensa" ? TEXTOS_ASSISTENTE.suspensa : TEXTOS_ASSISTENTE.semAcesso);
    return autor === "nao_vinculado" ? "nao_vinculado" : "negado";
  }
  const ctx: ContextoFerramenta = {
    contas: { empresaId: autor.empresaId, nome: autor.nome, papel: autor.pessoa.papel, modulos: autor.pessoa.modulos },
    hoje: agoraNoFuso(agora, autor.fusoHorario).hoje,
    somenteLeitura: autor.somenteLeitura,
  };
  const ferramentas = ferramentasDaPessoa(ctx.contas);
  if (ferramentas.length === 0) {
    await responder(TEXTOS_ASSISTENTE.semAcesso);
    return "negado";
  }
  if (texto.length > MAX_TEXTO_RECEBIDO) {
    await responder(TEXTOS_ASSISTENTE.longo);
    return "longa";
  }
  const memoria = lerMemoria(conversa?.mensagens, agora);
  const lembrar = (resposta: string, citadas: ContaCitada[] = []) =>
    gravarMemoria(
      autor.usuarioId,
      autor.empresaId,
      acrescentarNaMemoria(memoria, [
        { papel: "usuario", texto, em: agora.toISOString() },
        { papel: "assistente", texto: resposta, em: new Date().toISOString(), ...(citadas.length > 0 ? { refs: citadas.slice(0, 15).map((c) => `ref ${c.ref}: ${c.rotulo}`) } : {}) },
      ]),
      agora,
    );

  // Operação proposta esperando o SIM: a resposta curta decide sem passar pela IA; qualquer outra coisa descarta a
  // proposta (e a IA fica sabendo, para refazer se a pessoa estiver corrigindo um dado).
  let descartada: string | null = null;
  const pendente = await prisma.acaoAssistente.findFirst({ where: { usuarioId: autor.usuarioId, status: "aguardando_confirmacao" }, orderBy: { criadoEm: "desc" } });
  if (pendente) {
    const vencida = pendente.criadoEm < new Date(agora.getTime() - CONFIRMACAO_POR_MS).toISOString();
    const sim = ehSim(texto);
    const nao = ehNao(texto);
    const novoStatus = vencida ? "expirada" : nao ? "cancelada" : sim ? "confirmada" : "cancelada";
    // Consome a proposta antes de agir: dois SIM ao mesmo tempo executam uma vez só.
    const consumida = await prisma.acaoAssistente.updateMany({
      where: { id: pendente.id, status: "aguardando_confirmacao" },
      data: { status: novoStatus, ...(novoStatus === "cancelada" && !nao ? { detalhe: `${pendente.detalhe ?? ""}\n[descartada: a pessoa respondeu outra coisa]`.trim() } : {}) },
    });
    if (consumida.count === 1) {
      if (vencida && (sim || nao)) {
        await responder(TEXTOS_ASSISTENTE.confirmacaoVencida);
        await lembrar(TEXTOS_ASSISTENTE.confirmacaoVencida);
        return "expirada";
      }
      if (!vencida && nao) {
        await responder(TEXTOS_ASSISTENTE.descartada);
        await lembrar(TEXTOS_ASSISTENTE.descartada);
        return "cancelada";
      }
      if (!vencida && sim) {
        const resposta = await confirmarProposta(pendente, mensagem.chatId, ctx);
        await responder(resposta);
        await lembrar(resposta);
        return "executada";
      }
      if (!vencida) descartada = pendente.detalhe;
    }
  }

  if (!deps.modelo) {
    console.error("[whatsapp/assistente] ANTHROPIC_API_KEY ausente: assistente desligado.");
    await responder(TEXTOS_ASSISTENTE.falha);
    return "sem_ia";
  }

  const auditoria = { empresaId: autor.empresaId, usuarioId: autor.usuarioId, mensagemId: mensagem.mensagemId, resumoPedido: texto.slice(0, 200) };
  try {
    const { resposta, citadas } = await rodarConversa(deps.modelo, ferramentas, ctx, memoria, texto, agoraNoFuso(agora, autor.fusoHorario).extenso, auditoria, descartada);
    await responder(resposta);
    await lembrar(resposta, citadas);
    return "respondida";
  } catch (erro) {
    console.error("[whatsapp/assistente] falha:", erro instanceof Error ? erro.name : "erro");
    await responder(TEXTOS_ASSISTENTE.falha);
    return "falha";
  }
}

interface Auditoria {
  empresaId: string;
  usuarioId: string;
  mensagemId: string | null;
  resumoPedido: string;
}

async function rodarConversa(
  modelo: ModeloAssistente,
  ferramentas: Ferramenta[],
  ctx: ContextoFerramenta,
  memoria: MensagemDaConversa[],
  texto: string,
  agoraExtenso: string,
  auditoria: Auditoria,
  propostaDescartada: string | null,
): Promise<{ resposta: string; citadas: ContaCitada[] }> {
  const tools = ferramentas.map(definicaoParaIA);
  const messages: Anthropic.Beta.BetaMessageParam[] = paraMensagensDaIA(memoria);
  // A data de agora e as contas citadas antes vão na mensagem da pessoa: não nas instruções (quebraria o cache das
  // instruções e ferramentas) nem nas respostas antigas (a IA passava a imitar a anotação ao responder).
  const refs = refsRecentes(memoria);
  const anotacoes = [
    `[Agora: ${agoraExtenso}. Hoje = ${ctx.hoje}]`,
    ...(refs.length > 0 ? [`[Contas citadas antes nesta conversa: ${refs.join("; ")}]`] : []),
    ...(propostaDescartada
      ? [`[Operação descartada porque o usuário respondeu outra coisa em vez de SIM/NÃO; nada foi gravado. Se ele estiver corrigindo algum dado, proponha de novo com a correção. Era: ${propostaDescartada.replace(/\s*Responda \*SIM\*[\s\S]*$/, "").replace(/\n+/g, " ")}]`]
      : []),
  ];
  messages.push({ role: "user", content: `${anotacoes.join("\n")}\n${texto}` });
  const citadas = new Map<string, ContaCitada>();

  for (let rodada = 0; rodada < MAX_RODADAS; rodada++) {
    const r = await modelo.responder({ system: INSTRUCOES_ASSISTENTE, tools, messages });
    if (r.stop_reason === "refusal") return { resposta: TEXTOS_ASSISTENTE.falha, citadas: [] };
    // Conteúdo devolvido inteiro (inclusive blocos de raciocínio), como a API exige dentro do mesmo turno.
    messages.push({ role: "assistant", content: r.content });
    const pedidos = r.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (r.stop_reason !== "tool_use" || pedidos.length === 0) {
      const resposta = semAnotacoesInternas(
        r.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n"),
      );
      return { resposta: resposta || TEXTOS_ASSISTENTE.falha, citadas: [...citadas.values()] };
    }
    // Uma de cada vez: no máximo UMA operação de escrita é proposta por mensagem.
    const estado = { proposta: null as Proposta | null };
    const resultados = [];
    for (const p of pedidos) resultados.push(await executarFerramenta(ferramentas, ctx, p, auditoria, estado));
    for (const r2 of resultados) for (const c of r2.citadas) citadas.set(c.ref, c);
    // Operação proposta: a resposta é o resumo montado pelo SISTEMA (não o texto da IA), pedindo SIM ou NÃO.
    if (estado.proposta) return { resposta: estado.proposta.resumo, citadas: [...citadas.values()] };
    // Todos os resultados numa mensagem só (assim a IA continua pedindo ferramentas em paralelo).
    messages.push({ role: "user", content: resultados.map((x) => x.bloco) });
  }
  throw new Error("MAX_RODADAS");
}

async function executarFerramenta(
  ferramentas: Ferramenta[],
  ctx: ContextoFerramenta,
  pedido: Anthropic.Beta.BetaToolUseBlock,
  auditoria: Auditoria,
  estado: { proposta: Proposta | null },
): Promise<{ bloco: Anthropic.Beta.BetaToolResultBlockParam; citadas: ContaCitada[] }> {
  const erro = (mensagem: string) => ({ bloco: { type: "tool_result" as const, tool_use_id: pedido.id, is_error: true, content: mensagem }, citadas: [] });
  const ferramenta = ferramentas.find((f) => f.nome === pedido.name);
  const argumentos = (pedido.input ?? {}) as Prisma.InputJsonValue;
  if (!ferramenta) {
    await auditar(auditoria, pedido.name, argumentos, "negada", "ferramenta inexistente ou sem acesso");
    return erro("Ferramenta não disponível para esta pessoa.");
  }
  const lidos = ferramenta.entrada.safeParse(pedido.input);
  if (!lidos.success) {
    await auditar(auditoria, ferramenta.nome, argumentos, "invalida", lidos.error.issues[0]?.message ?? "argumentos inválidos");
    return erro(`Argumentos inválidos: ${lidos.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
  if (ferramenta.efetivar && estado.proposta) {
    await auditar(auditoria, ferramenta.nome, argumentos, "negada", "segunda operação na mesma mensagem");
    return erro("Uma operação por vez: espere o usuário confirmar a primeira.");
  }
  try {
    const r = await ferramenta.executar(ctx, lidos.data);
    if (r.proposta) {
      // Uma proposta por pessoa: a nova substitui qualquer outra que ainda esperava o SIM.
      await prisma.acaoAssistente.updateMany({ where: { usuarioId: auditoria.usuarioId, status: "aguardando_confirmacao" }, data: { status: "cancelada" } });
      await auditar(auditoria, ferramenta.nome, { pedido: argumentos, dados: r.proposta.dados as Prisma.InputJsonValue }, "aguardando_confirmacao", r.proposta.resumo);
      estado.proposta = r.proposta;
      return { bloco: { type: "tool_result", tool_use_id: pedido.id, content: "Proposta enviada ao usuário; aguardando SIM." }, citadas: r.citadas ?? [] };
    }
    await auditar(auditoria, ferramenta.nome, argumentos, "executada");
    return { bloco: { type: "tool_result", tool_use_id: pedido.id, content: JSON.stringify(r.dados) }, citadas: r.citadas ?? [] };
  } catch (e) {
    if (e instanceof PedidoIncompleto) {
      await auditar(auditoria, ferramenta.nome, argumentos, "incompleta", e.message.slice(0, 300));
      return erro(e.message);
    }
    const semAcesso = e instanceof Error && e.message === "SEM_ACESSO_MODULO";
    await auditar(auditoria, ferramenta.nome, argumentos, semAcesso ? "negada" : "erro", e instanceof Error ? e.message.slice(0, 200) : "erro");
    return erro(semAcesso ? "Esta pessoa não tem acesso a esse tipo de conta." : "O sistema não conseguiu consultar agora.");
  }
}

/**
 * A pessoa disse SIM: confere de novo QUEM é e se pode ESCREVER agora (a permissão ou o plano podem ter mudado desde a
 * proposta), grava pelo núcleo da aplicação e devolve o texto do resultado. A proposta já foi marcada "confirmada".
 */
async function confirmarProposta(proposta: { id: string; ferramenta: string; argumentos: Prisma.JsonValue }, chatId: string, ctxDaConversa: ContextoFerramenta): Promise<string> {
  const fim = (status: string, detalhe?: string, registroId?: string) =>
    prisma.acaoAssistente.update({ where: { id: proposta.id }, data: { status, ...(detalhe ? { detalhe } : {}), ...(registroId ? { registroId } : {}) } });
  const autor = await autorizarChat(chatId, { modulos: MODULOS_DE_GESTAO });
  if (typeof autor === "string") {
    await fim("negada", `autorização na confirmação: ${autor}`);
    return autor === "somente_leitura" ? TEXTOS_ASSISTENTE.somenteLeituraEscrita : autor === "suspensa" ? TEXTOS_ASSISTENTE.suspensa : TEXTOS_ASSISTENTE.semAcesso;
  }
  const ctx: ContextoFerramenta = {
    contas: { empresaId: autor.empresaId, nome: autor.nome, papel: autor.pessoa.papel, modulos: autor.pessoa.modulos },
    hoje: ctxDaConversa.hoje,
    somenteLeitura: false,
  };
  const ferramenta = ferramentasDaPessoa(ctx.contas).find((f) => f.nome === proposta.ferramenta && f.efetivar);
  if (!ferramenta?.efetivar) {
    await fim("negada", "ferramenta indisponível na confirmação");
    return TEXTOS_ASSISTENTE.semAcesso;
  }
  const dados = proposta.argumentos && typeof proposta.argumentos === "object" && !Array.isArray(proposta.argumentos) ? (proposta.argumentos as Record<string, unknown>).dados : undefined;
  try {
    const r = await ferramenta.efetivar(ctx, dados);
    await fim("executada", undefined, r.registroId);
    return r.texto;
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "erro";
    await fim("erro", mensagem.slice(0, 300));
    if (mensagem === "SEM_ACESSO_MODULO") return TEXTOS_ASSISTENTE.semAcesso;
    // Erros de regra do núcleo já vêm em português para a pessoa ("Só é possível editar lançamentos em aberto.").
    if (/\s/.test(mensagem) && !/prisma|invalid|unique|constraint|zod/i.test(mensagem)) return TEXTOS_ASSISTENTE.naoConcluiu(mensagem);
    console.error("[whatsapp/assistente] falha ao efetivar:", e instanceof Error ? e.name : "erro");
    return TEXTOS_ASSISTENTE.falha;
  }
}

async function auditar(a: Auditoria, ferramenta: string, argumentos: Prisma.InputJsonValue, status: string, detalhe?: string): Promise<void> {
  await prisma.acaoAssistente.create({
    data: { ...a, ferramenta: ferramenta.slice(0, 80), argumentos, status, detalhe: detalhe ?? null, criadoEm: new Date().toISOString() },
  });
}

/** A memória vira mensagens alternadas para a IA, sempre começando pela pessoa. */
function paraMensagensDaIA(memoria: MensagemDaConversa[]): Anthropic.Beta.BetaMessageParam[] {
  const inicio = memoria.findIndex((m) => m.papel === "usuario");
  if (inicio < 0) return [];
  return memoria.slice(inicio).map((m) => ({ role: m.papel === "usuario" ? "user" : "assistant", content: m.texto }));
}

async function gravarMemoria(usuarioId: string, empresaId: string, mensagens: MensagemDaConversa[], agora: Date): Promise<void> {
  const iso = agora.toISOString();
  const valor = mensagens as unknown as Prisma.InputJsonValue;
  await prisma.conversaWhatsapp.upsert({
    where: { usuarioId },
    create: { usuarioId, empresaId, mensagens: valor, criadoEm: iso, atualizadoEm: iso },
    update: { empresaId, mensagens: valor, atualizadoEm: iso },
  });
}

async function marcarAtendimentoHumano(usuarioId: string, empresaId: string, agora: Date): Promise<void> {
  const iso = agora.toISOString();
  const humanoAte = new Date(agora.getTime() + HUMANO_POR_MS).toISOString();
  await prisma.conversaWhatsapp.upsert({
    where: { usuarioId },
    create: { usuarioId, empresaId, mensagens: [], humanoAte, criadoEm: iso, atualizadoEm: iso },
    update: { humanoAte, atualizadoEm: iso },
  });
}

/**
 * Um atendente respondeu pelo próprio aparelho: o robô fica quieto nessa conversa por mais 2 h (a contar desta
 * resposta). Número sem vínculo não tem conversa com o robô, então não há o que fazer.
 */
export async function atendenteRespondeu(chatId: string, agora: Date = new Date()): Promise<boolean> {
  const vinculo = await prisma.vinculoWhatsapp.findUnique({ where: { chatId }, select: { verificadoEm: true, usuario: { select: { id: true, empresaId: true } } } });
  if (!vinculo?.verificadoEm) return false;
  await marcarAtendimentoHumano(vinculo.usuario.id, vinculo.usuario.empresaId, agora);
  return true;
}

/** Retenção: conversa parada há mais de 24 h perde a memória (o atendimento humano em curso é mantido). */
export async function limparMemoriasVencidas(agora: Date = new Date()): Promise<number> {
  const corte = new Date(agora.getTime() - MEMORIA_POR_MS).toISOString();
  const r = await prisma.conversaWhatsapp.deleteMany({ where: { atualizadoEm: { lt: corte }, OR: [{ humanoAte: null }, { humanoAte: { lt: agora.toISOString() } }] } });
  return r.count;
}
