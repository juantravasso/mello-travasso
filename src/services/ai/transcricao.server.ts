import "server-only";

// Transcrição dos áudios do WhatsApp (a API da Anthropic não recebe áudio). Usa o formato de API "audio/transcriptions"
// que Groq e OpenAI aceitam igual, então trocar de provedor é só trocar as variáveis:
//   TRANSCRICAO_API_KEY  (obrigatória: sem ela, o assistente avisa que ainda não ouve áudio)
//   TRANSCRICAO_URL      (padrão https://api.groq.com/openai/v1; OpenAI: https://api.openai.com/v1)
//   TRANSCRICAO_MODELO   (padrão whisper-large-v3-turbo; OpenAI: gpt-4o-mini-transcribe)
// O áudio vai para o provedor só para virar texto; nada dele é guardado aqui (só o texto entra na conversa).

export interface Transcritor {
  transcrever(audio: { base64: string; mimetype: string }): Promise<string>;
}

const EXTENSAO: Record<string, string> = {
  "audio/ogg": "ogg",
  "audio/opus": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "webm",
  "audio/amr": "amr",
};

export function extensaoDoAudio(mimetype: string): string | null {
  return EXTENSAO[mimetype.split(";")[0].trim().toLowerCase()] ?? null;
}

class TranscritorHttp implements Transcritor {
  constructor(
    private readonly chave: string,
    private readonly url: string,
    private readonly modelo: string,
  ) {}

  async transcrever(audio: { base64: string; mimetype: string }): Promise<string> {
    const extensao = extensaoDoAudio(audio.mimetype) ?? "ogg";
    const form = new FormData();
    form.append("file", new Blob([Buffer.from(audio.base64, "base64")], { type: audio.mimetype || "audio/ogg" }), `audio.${extensao}`);
    form.append("model", this.modelo);
    form.append("language", "pt");
    form.append("response_format", "json");
    const r = await fetch(`${this.url.replace(/\/+$/, "")}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.chave}` },
      body: form,
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) throw new Error(`TRANSCRICAO_${r.status}`);
    const corpo = (await r.json()) as { text?: unknown };
    return typeof corpo.text === "string" ? corpo.text.trim() : "";
  }
}

/** null quando não há chave: o recurso fica desligado. */
export function obterTranscritor(): Transcritor | null {
  const chave = process.env.TRANSCRICAO_API_KEY?.trim();
  if (!chave) return null;
  const url = process.env.TRANSCRICAO_URL?.trim() || "https://api.groq.com/openai/v1";
  // A chave só vai para um endereço HTTPS (evita mandar a chave em texto aberto por erro de configuração).
  if (!url.startsWith("https://")) {
    console.error("[ai/transcricao] TRANSCRICAO_URL precisa ser https: áudio desligado.");
    return null;
  }
  return new TranscritorHttp(chave, url, process.env.TRANSCRICAO_MODELO?.trim() || "whisper-large-v3-turbo");
}
