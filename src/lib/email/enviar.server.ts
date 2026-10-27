import "server-only";
import { MARCA } from "@/lib/marca";

// Envio de e-mail transacional pela API HTTP do Resend (sem dependência nova).
// Sem RESEND_API_KEY: em desenvolvimento a mensagem sai no console do servidor
// (o link de confirmação fica à mão); em produção nada é impresso — o corpo
// carrega um token e não pode vazar em log — e o envio conta como falha.

const ENDPOINT = "https://api.resend.com/emails";
const TEMPO_LIMITE_MS = 8000;

export interface MensagemEmail {
  para: string;
  assunto: string;
  texto: string;
  html: string;
  /** Mesma chave = no máximo um e-mail (o Resend guarda por 24 h). */
  chaveIdempotencia?: string;
  /** Cabeçalhos extras (ex.: List-Unsubscribe nas mensagens promocionais). */
  cabecalhos?: Record<string, string>;
}

// Fica em ./escapar para os modelos de e-mail puros (testáveis) usarem sem puxar o envio.
export { escaparHtml } from "./escapar";

/** true quando o provedor aceitou a mensagem. Nunca lança: quem chama decide o que dizer ao usuário. */
export async function enviarEmail(mensagem: MensagemEmail): Promise<boolean> {
  const chave = process.env.RESEND_API_KEY;
  const remetente = process.env.EMAIL_REMETENTE;

  if (!chave || !remetente) {
    if (process.env.NODE_ENV === "production") {
      console.error("[email] RESEND_API_KEY/EMAIL_REMETENTE ausentes: e-mail não enviado.");
      return false;
    }
    console.info(`[email:dev] para=${mensagem.para} assunto="${mensagem.assunto}"\n${mensagem.texto}`);
    return true;
  }

  try {
    const resposta = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chave}`,
        "Content-Type": "application/json",
        ...(mensagem.chaveIdempotencia ? { "Idempotency-Key": mensagem.chaveIdempotencia } : {}),
      },
      body: JSON.stringify({
        from: remetente,
        // Quem responde a um e-mail do sistema fala com o suporte, não com o endereço de envio (que ninguém lê).
        reply_to: MARCA.emailContato,
        to: [mensagem.para],
        subject: mensagem.assunto,
        text: mensagem.texto,
        html: mensagem.html,
        ...(mensagem.cabecalhos ? { headers: mensagem.cabecalhos } : {}),
      }),
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
    if (!resposta.ok) {
      // Só o status: o corpo do erro pode repetir o destinatário.
      console.error("[email] provedor recusou o envio:", resposta.status);
      return false;
    }
    return true;
  } catch (erro) {
    console.error("[email] falha ao chamar o provedor:", erro instanceof Error ? erro.name : "erro");
    return false;
  }
}
