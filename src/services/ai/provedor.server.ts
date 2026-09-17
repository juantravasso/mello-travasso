import type { ProvedorExtracaoIA } from "@/types";
import { AnthropicVisionProvider } from "./providers/anthropicProvider";
import { MockExtracaoProvider } from "./providers/mockProvider";

/**
 * Server-only: escolhe o provedor de IA conforme as variáveis de ambiente.
 * Importado apenas por src/app/api/ai/extract-recibo/route.ts.
 */
export function obterProvedorExtracaoIA(): ProvedorExtracaoIA {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    return new AnthropicVisionProvider(apiKey);
  }
  console.warn(
    "[ai] ANTHROPIC_API_KEY não configurada — usando MockExtracaoProvider. " +
      "Configure a chave em .env.local (dev) ou nas variáveis de ambiente da Vercel (produção).",
  );
  return new MockExtracaoProvider();
}
