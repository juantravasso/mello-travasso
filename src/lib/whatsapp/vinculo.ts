import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";

// Vínculo entre um usuário e o WhatsApp dele. A pessoa prova que controla o número ENVIANDO um código ao número do Elo:
// o Elo nunca escreve primeiro (menos risco de bloqueio do número e nada de código por SMS/WhatsApp para número alheio).
// Tudo aqui é puro e testável; quem fala com o WAHA e com o banco são os módulos .server.

/** Sem 0/O/1/I/L para ninguém errar ao digitar (o código costuma ir pronto no link, mas pode ser digitado). */
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const TAMANHO_CODIGO = 8;
export const VALIDADE_CODIGO_MIN = 30;
const PALAVRA_VINCULO = "VINCULAR";

export function gerarCodigo(): string {
  let codigo = "";
  for (let i = 0; i < TAMANHO_CODIGO; i++) codigo += ALFABETO[randomInt(ALFABETO.length)];
  return codigo;
}

/** Só o hash vai ao banco: quem lê um dump não consegue vincular nada. */
export function hashCodigo(codigo: string): string {
  return createHash("sha256").update(codigo.toUpperCase()).digest("hex");
}

/**
 * Tira o código de uma mensagem do tipo "VINCULAR AB12CD34" (ignora maiúsculas, espaços e pontuação ao redor).
 * Qualquer outra mensagem devolve null: o Elo não responde a conversa comum (isso é do suporte, feito por pessoas).
 */
export function extrairCodigo(texto: string | null | undefined): string | null {
  if (!texto || texto.length > 80) return null;
  const m = new RegExp(`^\\s*${PALAVRA_VINCULO}[\\s:.-]*([A-Za-z0-9]{${TAMANHO_CODIGO}})\\s*[.!]?\\s*$`, "i").exec(texto);
  if (!m) return null;
  const codigo = m[1].toUpperCase();
  return [...codigo].every((c) => ALFABETO.includes(c)) ? codigo : null;
}

/** Só conversa individual conta: grupos, status, canais e transmissões são ignorados. */
export function ehChatIndividual(chatId: string | null | undefined): boolean {
  return !!chatId && /^[0-9A-Za-z.-]+@(c\.us|s\.whatsapp\.net|lid)$/.test(chatId);
}

/** Telefone (só dígitos) quando o identificador é de verdade um telefone; `@lid` é um código anônimo, não um número. */
export function numeroDoChat(chatId: string): string | null {
  const m = /^(\d{10,15})@(c\.us|s\.whatsapp\.net)$/.exec(chatId);
  return m ? m[1] : null;
}

/** Link que abre o WhatsApp já com a mensagem pronta (o número do Elo vem da configuração, só dígitos com DDI). */
export function linkDeVinculo(numeroElo: string, codigo: string): string {
  return `https://wa.me/${numeroElo}?text=${encodeURIComponent(`${PALAVRA_VINCULO} ${codigo}`)}`;
}

export const textoDeVinculo = (codigo: string): string => `${PALAVRA_VINCULO} ${codigo}`;

/** Número do Elo só com dígitos e DDI (ex.: 5521985097600); inválido vira null e o recurso fica desligado. */
export function numeroEloValido(bruto: string | undefined): string | null {
  const d = (bruto ?? "").replace(/\D/g, "");
  return /^\d{12,13}$/.test(d) ? d : null;
}

/**
 * Confere a assinatura do webhook do WAHA: HMAC-SHA512 em hex do CORPO BRUTO, no cabeçalho X-Webhook-Hmac. Compara em
 * tempo constante. Sem chave ou sem cabeçalho, nunca confere.
 */
export function assinaturaWahaConfere(corpoBruto: string, cabecalho: string | null, chave: string): boolean {
  if (!cabecalho || !chave) return false;
  const esperado = createHmac("sha512", chave).update(corpoBruto, "utf8").digest();
  const recebido = Buffer.from(cabecalho.trim(), "hex");
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

export interface MensagemRecebida {
  chatId: string;
  texto: string;
  /** Telefone, quando o WAHA informa (nem sempre informa: `@lid`). */
  numero: string | null;
}

/**
 * Lê o corpo do webhook do WAHA e devolve a mensagem recebida (de outra pessoa, em conversa individual), ou null para
 * qualquer outra coisa. Não confia em nada: tudo é checado como `unknown`.
 */
export function lerMensagemWaha(corpo: unknown, sessaoEsperada: string): MensagemRecebida | null {
  if (!corpo || typeof corpo !== "object") return null;
  const c = corpo as Record<string, unknown>;
  if (c.event !== "message") return null;
  if (typeof c.session === "string" && c.session !== sessaoEsperada) return null;
  const p = c.payload;
  if (!p || typeof p !== "object") return null;
  const m = p as Record<string, unknown>;
  if (m.fromMe === true) return null;
  const chatId = typeof m.from === "string" ? m.from : null;
  if (!chatId || !ehChatIndividual(chatId)) return null;
  const texto = typeof m.body === "string" ? m.body : "";
  const numero = numeroDoChat(chatId) ?? numeroDoCampoAlternativo(m);
  return { chatId, texto, numero };
}

/** O WAHA às vezes traz o telefone ao lado do `@lid` (campos do NOWEB/WEBJS). Só aceita se vier como telefone de verdade. */
function numeroDoCampoAlternativo(m: Record<string, unknown>): string | null {
  const dados = m._data;
  if (!dados || typeof dados !== "object") return null;
  const chave = (dados as Record<string, unknown>).key;
  const alt = chave && typeof chave === "object" ? (chave as Record<string, unknown>).remoteJidAlt : null;
  return typeof alt === "string" ? numeroDoChat(alt) : null;
}
