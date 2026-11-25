import "server-only";
import { after } from "next/server";
import { obterProvedorExtracaoIA } from "@/services/ai/provedor.server";
import { baixarMidia, enviarTexto } from "@/lib/whatsapp/cliente.server";
import type { MensagemRecebida } from "@/lib/whatsapp/vinculo";
import { processarFotoRecebida } from "./whatsappCompraCore.server";
import { tratarMensagemRecebida } from "./whatsappCore.server";

// O que fazer com uma mensagem já autenticada e lida, seja qual for o provedor (WAHA ou uazapi). Só responde ao que o
// sistema reconhece; o resto da conversa é do suporte, feito por pessoas no próprio aparelho.

const RESPOSTAS = {
  vinculado: (nome: string) =>
    `Pronto${nome ? `, ${nome}` : ""}! Seu WhatsApp está vinculado ao Elo Negócios. Você vai receber por aqui os avisos da sua conta, e pode desligar quando quiser em Configurações.`,
  codigo_invalido: "Esse código não vale mais ou não existe. Gere um novo em Configurações, no Elo Negócios, e envie de novo.",
  chat_em_uso: "Este WhatsApp já está vinculado a outra conta do Elo Negócios. Para usar nesta, desvincule na outra em Configurações.",
} as const;

export async function responderMensagemRecebida(mensagem: MensagemRecebida, origem: string): Promise<void> {
  if (mensagem.midia) {
    // Ler a nota com IA leva segundos: o webhook responde já, e a leitura roda depois da resposta (after), dentro do
    // maxDuration da rota. A pessoa recebe "Lendo a nota…" e depois o resumo do rascunho.
    after(async () => {
      try {
        await processarFotoRecebida(mensagem, {
          baixar: baixarMidia,
          extrair: (s) => obterProvedorExtracaoIA().extrair(s),
          responder: enviarTexto,
        });
      } catch (erro) {
        console.error(`[webhooks/${origem}] foto não processada:`, erro instanceof Error ? erro.name : "erro");
      }
    });
    return;
  }
  const resultado = await tratarMensagemRecebida(mensagem);
  if (resultado.tipo === "ignorada") return;
  const texto = resultado.tipo === "vinculado" ? RESPOSTAS.vinculado(resultado.primeiroNome) : RESPOSTAS[resultado.tipo];
  // A resposta é cortesia: se o provedor falhar, o vínculo já foi gravado e o webhook não precisa ser repetido.
  await enviarTexto(mensagem.chatId, texto).catch((e) => console.error(`[webhooks/${origem}] resposta não enviada:`, e instanceof Error ? e.name : "erro"));
}
