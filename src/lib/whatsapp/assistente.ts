// Assistente do WhatsApp: regras puras e testáveis (modo atendente, memória curta da conversa, textos fixos). A IA só
// interpreta o pedido; quem consulta e grava são as ferramentas da aplicação, com as mesmas regras do site.

/** Quanto tempo o robô fica quieto depois que a pessoa pede um atendente (ou um atendente responde pelo aparelho). */
export const HUMANO_POR_MS = 2 * 60 * 60 * 1000;
/** A memória da conversa guarda só as últimas trocas, e some depois de 24 h sem conversa (LGPD: o mínimo necessário). */
export const MAX_MENSAGENS_NA_MEMORIA = 20;
export const MEMORIA_POR_MS = 24 * 60 * 60 * 1000;
/** Uns 2 minutos de fala transcrita cabem aqui. */
export const MAX_TEXTO_RECEBIDO = 2000;

export interface MensagemDaConversa {
  papel: "usuario" | "assistente";
  texto: string;
  /** ISO */
  em: string;
  /** Contas citadas nesta resposta ("ref 1a2b3c4d: Vivo · R$ 150,00 · vence 2026-11-27"), para "aquela conta" depois. */
  refs?: string[];
}

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** "falar com atendente", "quero falar com uma pessoa", "atendente", "suporte humano"… */
export function pedeAtendente(texto: string): boolean {
  const t = semAcento(texto).replace(/[!?.]+$/g, "");
  if (/^(atendente|atendimento|humano|suporte)$/.test(t)) return true;
  return /\b(falar|conversar|chamar?|quero|preciso)\b.{0,25}\b(atendente|atendimento humano|humano|pessoa|alguem|suporte)\b/.test(t);
}

/** "assistente" / "voltar ao assistente": devolve a conversa ao robô antes das 2 h. */
export function pedeAssistente(texto: string): boolean {
  const t = semAcento(texto).replace(/[!?.]+$/g, "");
  return /^(assistente|voltar( (ao|para o|pro))? assistente|robo)$/.test(t);
}

/** Quanto tempo uma operação proposta espera o SIM. Depois disso, é preciso pedir de novo. */
export const CONFIRMACAO_POR_MS = 15 * 60 * 1000;

const limpo = (texto: string) => semAcento(texto).replace(/[!.,;:]+/g, "").replace(/\s+/g, " ").trim();

/** "sim", "pode", "confirmo", "ok", "isso", 👍… Só a resposta curta: "sim, mas muda o valor" não confirma. */
export function ehSim(texto: string): boolean {
  const t = limpo(texto);
  return /^(sim|s|ss|sim sim|confirmo|confirmar|confirma|confirmado|pode|pode sim|pode ser|pode lancar|pode fazer|ok|okay|blz|beleza|isso|isso mesmo|certo|correto|claro|manda|manda ver|fechado|\u{1F44D}[\u{1F3FB}-\u{1F3FF}]?)$/u.test(t);
}

/** "não", "cancela", "esquece"… */
export function ehNao(texto: string): boolean {
  const t = limpo(texto);
  return /^(nao|n|nao nao|cancela|cancelar|cancelado|esquece|deixa|deixa pra la|negativo|nem|nao quero|nao lanca|para)$/.test(t);
}

export function emAtendimentoHumano(humanoAte: string | null | undefined, agora: Date): boolean {
  return Boolean(humanoAte && humanoAte > agora.toISOString());
}

/** Lê a memória gravada (JSON) descartando o que for estranho ou velho, e mantém só as últimas trocas. */
export function lerMemoria(json: unknown, agora: Date): MensagemDaConversa[] {
  if (!Array.isArray(json)) return [];
  const corte = new Date(agora.getTime() - MEMORIA_POR_MS).toISOString();
  return json
    .filter((m): m is MensagemDaConversa => {
      if (!m || typeof m !== "object") return false;
      const x = m as Record<string, unknown>;
      return (x.papel === "usuario" || x.papel === "assistente") && typeof x.texto === "string" && typeof x.em === "string";
    })
    .filter((m) => m.em >= corte)
    .slice(-MAX_MENSAGENS_NA_MEMORIA);
}

/** Referências das contas citadas nas últimas respostas (as mais recentes primeiro, sem repetir), no máximo 15. */
export function refsRecentes(memoria: MensagemDaConversa[]): string[] {
  const vistas = new Set<string>();
  for (const m of [...memoria].reverse()) for (const r of m.refs ?? []) if (vistas.size < 15) vistas.add(r);
  return [...vistas];
}

/** Rede de segurança: anotação interna nunca vai para o WhatsApp, mesmo que a IA a copie. */
export function semAnotacoesInternas(texto: string): string {
  return texto.replace(/\[(?:Contexto interno|Contas citadas|Agora:|Operação descartada)[^\]]*\]/gi, "").replace(/\n{3,}/g, "\n\n").trim();
}

export function acrescentarNaMemoria(memoria: MensagemDaConversa[], novas: MensagemDaConversa[]): MensagemDaConversa[] {
  return [...memoria, ...novas].slice(-MAX_MENSAGENS_NA_MEMORIA);
}

/** Dia de hoje (aaaa-mm-dd) e a data/hora por extenso no fuso da empresa, para a IA resolver "hoje", "sexta", "este mês". */
export function agoraNoFuso(agora: Date, fuso: string): { hoje: string; extenso: string } {
  const hoje = agora.toLocaleDateString("sv-SE", { timeZone: fuso });
  const extenso = agora.toLocaleString("pt-BR", { timeZone: fuso, weekday: "long", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return { hoje, extenso };
}

export const TEXTOS_ASSISTENTE = {
  atendente: "Certo! Vou chamar um atendente da equipe Elo para continuar por aqui. Enquanto isso eu fico em silêncio. Para voltar a falar comigo antes, é só mandar ASSISTENTE.",
  voltei: "Voltei! Pode perguntar sobre suas contas, pagamentos e recebimentos.",
  limite: "Recebi muitas mensagens em pouco tempo. Espere alguns minutos e tente de novo.",
  limiteEmpresa: "O assistente atingiu o limite de mensagens de hoje da sua empresa. Amanhã ele volta; até lá, use o app.",
  falha: "Não consegui responder agora. Tente de novo em alguns minutos ou abra o app.",
  semAcesso: "Sua conta não tem acesso a essas informações pelo WhatsApp. Fale com o responsável pela empresa.",
  suspensa: "A assinatura da sua empresa está suspensa, então o assistente fica pausado. Seus dados continuam no app; ao regularizar a assinatura, ele volta na hora.",
  longo: "Essa mensagem ficou longa demais para mim. Pode resumir o que precisa?",
  descartada: "Ok, não fiz nada.",
  semAudio: "Ainda não consigo ouvir áudio por aqui. Pode mandar por texto?",
  audioGrande: "Esse áudio ficou longo demais para mim (até uns 2 minutos). Pode mandar um mais curto ou por texto?",
  audioFalhou: "Não consegui ouvir esse áudio agora. Tente de novo ou mande por texto.",
  audioVazio: "Não entendi o áudio. Pode repetir, mais perto do microfone, ou mandar por texto?",
  ouvi: (texto: string) => `_Ouvi: "${texto.length > 160 ? `${texto.slice(0, 157)}…` : texto}"_`,
  confirmacaoVencida: "Essa confirmação expirou (vale 15 minutos). Me peça de novo que eu refaço o resumo.",
  somenteLeituraEscrita: "Sua empresa está em modo somente leitura (o teste acabou), então não lancei nada. As consultas continuam valendo.",
  naoConcluiu: (motivo: string) => `Não consegui concluir: ${motivo}`,
} as const;
