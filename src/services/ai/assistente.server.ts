import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Modelo do assistente do WhatsApp: uma chamada da API de Mensagens com as ferramentas da aplicação. O laço (chamar a
// ferramenta, devolver o resultado) fica em assistenteCore.server.ts, que valida cada pedido antes de executar.
//
// Configuração (servidor): ANTHROPIC_API_KEY (a mesma da leitura de notas) e, opcional, ASSISTENTE_MODELO (padrão
// claude-haiku-5-5) e ASSISTENTE_ESFORCO (low | medium | high; padrão low: respostas curtas de chat, menor custo).
// O Haiku foi avaliado com scripts/avaliar-assistente-ia.ts; para voltar ao Opus: ASSISTENTE_MODELO=claude-opus-5-5.

export interface PedidoAoModelo {
  system: string;
  tools: Anthropic.Beta.BetaTool[];
  messages: Anthropic.Beta.BetaMessageParam[];
}

export interface ModeloAssistente {
  responder(pedido: PedidoAoModelo): Promise<Anthropic.Beta.BetaMessage>;
}

const ESFORCOS = new Set(["low", "medium", "high"]);

class ModeloAnthropic implements ModeloAssistente {
  private readonly cliente: Anthropic;
  private readonly modelo: string;
  private readonly esforco: "low" | "medium" | "high";

  constructor(apiKey: string) {
    // 25 s por chamada e uma nova tentativa: o processamento inteiro precisa caber nos 60 s da rota do webhook.
    this.cliente = new Anthropic({ apiKey, timeout: 25_000, maxRetries: 1 });
    this.modelo = process.env.ASSISTENTE_MODELO?.trim() || "claude-haiku-5-5";
    const esforco = process.env.ASSISTENTE_ESFORCO?.trim() ?? "low";
    this.esforco = (ESFORCOS.has(esforco) ? esforco : "low") as "low" | "medium" | "high";
  }

  async responder(pedido: PedidoAoModelo): Promise<Anthropic.Beta.BetaMessage> {
    return this.cliente.beta.messages.create({
      model: this.modelo,
      max_tokens: 4096,
      // Se o modelo recusar por política, a própria API refaz o pedido num modelo alternativo (o Haiku não tem essa opção;
      // a recusa vira a resposta de falha no assistente).
      ...(this.modelo.startsWith("claude-haiku") ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }),
      output_config: { effort: this.esforco },
      // Ferramentas + instruções não mudam entre mensagens: ficam em cache (o que muda vem depois, nas mensagens).
      system: [{ type: "text", text: pedido.system, cache_control: { type: "ephemeral" } }],
      tools: pedido.tools,
      messages: pedido.messages,
    });
  }
}

/** null quando não há chave da Anthropic (desenvolvimento): o assistente avisa que não pode responder. */
export function obterModeloAssistente(): ModeloAssistente | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return apiKey ? new ModeloAnthropic(apiKey) : null;
}
