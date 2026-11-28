import "server-only";
import { prisma } from "@/lib/prisma";
import { verificarLimite } from "@/lib/auth/limite";
import { emAtendimentoHumano, TEXTOS_ASSISTENTE } from "@/lib/whatsapp/assistente";
import type { MidiaBaixada } from "@/lib/whatsapp/cliente.server";
import type { MensagemRecebida } from "@/lib/whatsapp/vinculo";
import type { Transcritor } from "@/services/ai/transcricao.server";
import { registrarEvento } from "../eventosCore.server";
import { conversarComAssistente, type DependenciasAssistente, type DesfechoAssistente } from "./assistenteCore.server";

// Mensagem de voz: vira texto (transcrição) e segue para o assistente como se fosse digitada, com as MESMAS barreiras.
// Antes de pagar a transcrição, confere o barato: número vinculado, atendimento humano, repetição e limite.
// A resposta começa com o que foi entendido, para a pessoa perceber na hora se o áudio foi mal ouvido.

/** Uns 2 a 3 minutos de áudio do WhatsApp (Opus a 16–32 kbps), o que cabe no limite de texto do assistente. */
export const TAMANHO_MAX_AUDIO_BYTES = 600_000;
const AUDIOS_POR_HORA = 20;

export interface DependenciasAudio extends DependenciasAssistente {
  transcritor: Transcritor | null;
  baixar: (mensagem: MensagemRecebida, limiteBytes: number) => Promise<MidiaBaixada>;
}

export type DesfechoAudio = DesfechoAssistente | "sem_transcricao" | "audio_grande" | "nao_entendeu";

export async function processarAudioRecebido(mensagem: MensagemRecebida, deps: DependenciasAudio): Promise<DesfechoAudio> {
  const agora = deps.agora?.() ?? new Date();
  const responder = (t: string) => deps.enviar(mensagem.chatId, t).catch(() => console.error("[whatsapp/audio] resposta não enviada"));

  const vinculo = await prisma.vinculoWhatsapp.findUnique({ where: { chatId: mensagem.chatId }, select: { verificadoEm: true, usuario: { select: { id: true, empresaId: true } } } });
  if (!vinculo?.verificadoEm) return "nao_vinculado";
  const conversa = await prisma.conversaWhatsapp.findUnique({ where: { usuarioId: vinculo.usuario.id }, select: { humanoAte: true } });
  if (emAtendimentoHumano(conversa?.humanoAte, agora)) return "humano";

  if (mensagem.mensagemId) {
    const nova = await registrarEvento(prisma, { tipo: "whatsapp_assistente_mensagem", empresaId: vinculo.usuario.empresaId, usuarioId: vinculo.usuario.id, chave: `whatsapp_audio:${mensagem.mensagemId}`, agora });
    if (!nova) return "repetida";
  }
  if (!deps.transcritor) {
    await responder(TEXTOS_ASSISTENTE.semAudio);
    return "sem_transcricao";
  }
  const limite = await verificarLimite(`assistente:audio:${vinculo.usuario.id}`, AUDIOS_POR_HORA, 60 * 60 * 1000);
  if (!limite.permitido) {
    await responder(TEXTOS_ASSISTENTE.limite);
    return "limite";
  }

  let texto: string;
  try {
    const audio = await deps.baixar(mensagem, TAMANHO_MAX_AUDIO_BYTES);
    texto = (await deps.transcritor.transcrever({ base64: audio.base64, mimetype: audio.mimetype })).replace(/\s+/g, " ").trim();
  } catch (erro) {
    const grande = erro instanceof Error && "status" in erro && (erro as { status?: number }).status === 413;
    console.error("[whatsapp/audio] falha:", erro instanceof Error ? erro.name : "erro");
    await responder(grande ? TEXTOS_ASSISTENTE.audioGrande : TEXTOS_ASSISTENTE.audioFalhou);
    return grande ? "audio_grande" : "falha";
  }
  if (texto.length < 2) {
    await responder(TEXTOS_ASSISTENTE.audioVazio);
    return "nao_entendeu";
  }

  // A primeira resposta mostra o que foi ouvido. O texto segue com o mesmo id da mensagem (a repetição é conferida
  // de novo lá dentro, com outra chave).
  let primeira = true;
  const enviar = async (chatId: string, t: string) => {
    const corpo = primeira ? `${TEXTOS_ASSISTENTE.ouvi(texto)}\n\n${t}` : t;
    primeira = false;
    await deps.enviar(chatId, corpo);
  };
  return conversarComAssistente({ ...mensagem, texto, midia: null }, { ...deps, enviar, agora: () => agora });
}
