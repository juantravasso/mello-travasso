import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { extrairCodigo, gerarCodigo, hashCodigo, VALIDADE_CODIGO_MIN, type MensagemRecebida } from "@/lib/whatsapp/vinculo";

// Vínculo do usuário com o WhatsApp (ver src/lib/whatsapp/vinculo.ts). Aqui ficam as regras que tocam o banco.

export interface CodigoGerado {
  codigo: string;
  expiraEm: string;
}

/**
 * Gera um código novo (substitui o anterior ainda não usado). Quem já está vinculado precisa desvincular antes: trocar
 * de número em silêncio deixaria avisos indo para o aparelho errado.
 */
export async function gerarCodigoDeVinculo(usuarioId: string): Promise<CodigoGerado> {
  const agora = new Date();
  const agoraIso = agora.toISOString();
  const expiraEm = new Date(agora.getTime() + VALIDADE_CODIGO_MIN * 60_000).toISOString();
  const existente = await prisma.vinculoWhatsapp.findUnique({ where: { usuarioId } });
  if (existente?.verificadoEm) throw new Error("JA_VINCULADO");

  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const codigo = gerarCodigo();
    try {
      await prisma.vinculoWhatsapp.upsert({
        where: { usuarioId },
        create: { usuarioId, codigoHash: hashCodigo(codigo), codigoExpiraEm: expiraEm, criadoEm: agoraIso, atualizadoEm: agoraIso },
        update: { codigoHash: hashCodigo(codigo), codigoExpiraEm: expiraEm, atualizadoEm: agoraIso },
      });
      return { codigo, expiraEm };
    } catch (erro) {
      // Colisão de hash (praticamente impossível): sorteia outro.
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") continue;
      throw erro;
    }
  }
  throw new Error("CODIGO_NAO_GERADO");
}

export type ResultadoMensagem =
  | { tipo: "vinculado"; primeiroNome: string }
  | { tipo: "codigo_invalido" }
  | { tipo: "chat_em_uso" }
  | { tipo: "ignorada" };

/**
 * Trata uma mensagem recebida. Só a mensagem "VINCULAR <código>" faz algo; qualquer outra conversa é ignorada (é do
 * suporte, que responde pelo próprio aparelho). Mensagem de quem já está vinculado só atualiza o "último contato".
 */
export async function tratarMensagemRecebida(msg: MensagemRecebida): Promise<ResultadoMensagem> {
  const agoraIso = new Date().toISOString();
  const codigo = extrairCodigo(msg.texto);

  if (!codigo) {
    await prisma.vinculoWhatsapp.updateMany({ where: { chatId: msg.chatId }, data: { ultimaMensagemEm: agoraIso } });
    return { tipo: "ignorada" };
  }

  const vinculo = await prisma.vinculoWhatsapp.findUnique({ where: { codigoHash: hashCodigo(codigo) }, include: { usuario: { select: { nome: true } } } });
  if (!vinculo || !vinculo.codigoExpiraEm || vinculo.codigoExpiraEm <= agoraIso) return { tipo: "codigo_invalido" };

  const dono = await prisma.vinculoWhatsapp.findUnique({ where: { chatId: msg.chatId }, select: { usuarioId: true } });
  if (dono && dono.usuarioId !== vinculo.usuarioId) return { tipo: "chat_em_uso" };

  try {
    // Consome o código na mesma condição em que o encontrou: duas mensagens iguais ao mesmo tempo vinculam uma vez só.
    const r = await prisma.vinculoWhatsapp.updateMany({
      where: { id: vinculo.id, codigoHash: vinculo.codigoHash },
      data: { chatId: msg.chatId, numero: msg.numero, verificadoEm: agoraIso, codigoHash: null, codigoExpiraEm: null, avisosAtivos: true, ultimaMensagemEm: agoraIso, atualizadoEm: agoraIso },
    });
    if (r.count === 0) return { tipo: "codigo_invalido" };
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") return { tipo: "chat_em_uso" };
    throw erro;
  }
  return { tipo: "vinculado", primeiroNome: vinculo.usuario.nome.trim().split(/\s+/)[0] ?? "" };
}

export interface EstadoVinculo {
  vinculado: boolean;
  avisosAtivos: boolean;
  /** Telefone mascarado para mostrar na tela; nulo quando o WhatsApp não informou o número (@lid). */
  numeroMascarado: string | null;
  /** Há um código gerado e ainda válido, aguardando a mensagem. */
  aguardando: boolean;
}

export function mascararNumero(numero: string | null): string | null {
  if (!numero) return null;
  const nacional = numero.startsWith("55") ? numero.slice(2) : numero;
  if (nacional.length < 10) return null;
  return `(${nacional.slice(0, 2)}) •••••-${nacional.slice(-4)}`;
}

export async function estadoDoVinculo(usuarioId: string): Promise<EstadoVinculo> {
  const v = await prisma.vinculoWhatsapp.findUnique({ where: { usuarioId } });
  const vinculado = !!v?.verificadoEm;
  return {
    vinculado,
    avisosAtivos: vinculado && v.avisosAtivos,
    numeroMascarado: vinculado ? mascararNumero(v.numero) : null,
    aguardando: !vinculado && !!v?.codigoExpiraEm && v.codigoExpiraEm > new Date().toISOString(),
  };
}

export async function definirAvisos(usuarioId: string, ativos: boolean): Promise<void> {
  await prisma.vinculoWhatsapp.updateMany({ where: { usuarioId, verificadoEm: { not: null } }, data: { avisosAtivos: ativos, atualizadoEm: new Date().toISOString() } });
}

/** A pessoa desfaz o próprio vínculo: some o número e o identificador do chat. */
export async function desfazerVinculo(usuarioId: string): Promise<void> {
  await prisma.vinculoWhatsapp.deleteMany({ where: { usuarioId } });
}
