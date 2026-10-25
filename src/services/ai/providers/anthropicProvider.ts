import Anthropic from "@anthropic-ai/sdk";
import type { DadosExtraidosComprovante, ProvedorExtracaoIA, ResultadoExtracao, SolicitacaoExtracao } from "@/types";
import { dadosExtraidosComprovanteSchema } from "@/lib/validacao/comprovante";

/**
 * Provedor de extração usando a API de visão da Anthropic (Claude).
 *
 * Por quê Claude: já é o provedor deste projeto (Claude Code), suporta
 * imagem + "tool use" para forçar saída JSON estruturada (evita parsing
 * frágil de texto livre) e tem bom desempenho em documentos em português.
 *
 * Configuração: defina ANTHROPIC_API_KEY nas variáveis de ambiente do
 * servidor (Vercel → Project Settings → Environment Variables, ou .env.local
 * localmente — NUNCA no .env commitado nem em código do cliente). Esta
 * classe só deve ser instanciada em código server-side (API routes),
 * nunca importada por componentes client.
 */

const FERRAMENTA_EXTRACAO = "registrar_extracao_comprovante";

const ESQUEMA_ITEM_NOTA_FISCAL = {
  type: "object",
  properties: {
    descricao: { type: "string" },
    quantidade: { type: "number" },
    unidade: { type: "string" },
    valorUnitario: { type: "number" },
    valorTotal: { type: "number" },
  },
};

const ESQUEMA_EXTRACAO: Anthropic.Tool.InputSchema = {
  type: "object",
  properties: {
    tipoDocumento: {
      type: "string",
      enum: ["comprovante", "nota_fiscal"],
      description:
        "'nota_fiscal' se a imagem tiver CNPJ do emitente e tabela de itens/produtos; 'comprovante' para recibos e comprovantes de pagamento simples",
    },
    valor: { type: "number", description: "Valor total pago/da nota, em reais" },
    data: { type: "string", description: "Data do documento no formato ISO yyyy-mm-dd" },
    favorecido: { type: "string", description: "Nome do fornecedor/favorecido/emitente" },
    cnpjFavorecido: {
      type: "string",
      description:
        "CNPJ ou CPF do fornecedor/favorecido/emitente, só números ou formatado — procure em qualquer tipo de documento (cabeçalho, rodapé, ao lado do nome), não só em nota fiscal. Omita se não encontrar.",
    },
    descricao: { type: "string", description: "Descrição curta do gasto" },
    categoriaSugerida: {
      type: "string",
      enum: [
        "aluguel",
        "aluguel_equipamentos",
        "fretes",
        "pro_labore",
        "custo_funcionario",
        "custo_produtos",
        "manutencao_veiculos",
        "custo_transporte",
        "outros_custos_despesas",
      ],
      description: "Categoria do gasto (conta a pagar). Se não tiver certeza, prefira 'outros_custos_despesas'.",
    },
    itens: {
      type: "array",
      items: ESQUEMA_ITEM_NOTA_FISCAL,
      description: "Lista de itens, apenas quando o documento for uma nota fiscal",
    },
    confiancaExtracao: {
      type: "number",
      description: "Confiança geral da extração, de 0 a 1",
    },
    camposComBaixaConfianca: {
      type: "array",
      items: { type: "string" },
      description: "Nomes dos campos acima em que a IA não teve certeza e que precisam de revisão manual",
    },
  },
  required: ["tipoDocumento", "confiancaExtracao", "camposComBaixaConfianca"],
};

const INSTRUCAO_EXTRACAO = `Analise a imagem e identifique primeiro se é uma NOTA FISCAL (tem CNPJ do emitente e tabela de itens) ou um COMPROVANTE DE PAGAMENTO simples (recibo, comprovante bancário, sem tabela de itens).

Se for nota fiscal: extraia emitente, CNPJ, data de emissão, valor total e a lista completa de itens (descrição, quantidade, unidade, valor unitário e valor total de cada item).
Se for comprovante simples: extraia valor pago, data, favorecido e uma descrição curta do gasto. Não é necessário listar itens.

Em QUALQUER um dos dois casos, procure também o CNPJ ou CPF do fornecedor/favorecido/emitente em qualquer parte do documento (não só nota fiscal) e preencha em cnpjFavorecido — esse número é usado para identificar o fornecedor sem duplicar cadastro, então vale a pena procurar com atenção antes de desistir.

Se não conseguir ler algum campo com segurança, OMITA o campo (não invente valores) e liste o nome dele em camposComBaixaConfianca.`;

export class AnthropicVisionProvider implements ProvedorExtracaoIA {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(apiKey: string, model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5") {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async extrair(solicitacao: SolicitacaoExtracao): Promise<ResultadoExtracao> {
    try {
      const resposta = await this.client.messages.create({
        model: this.model,
        max_tokens: 1500,
        tools: [
          {
            name: FERRAMENTA_EXTRACAO,
            description: "Registra os dados extraídos do comprovante/nota fiscal fotografado.",
            input_schema: ESQUEMA_EXTRACAO,
          },
        ],
        tool_choice: { type: "tool", name: FERRAMENTA_EXTRACAO },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: solicitacao.mimeType,
                  data: solicitacao.imagemBase64,
                },
              },
              {
                type: "text",
                text: INSTRUCAO_EXTRACAO,
              },
            ],
          },
        ],
      });

      const blocoFerramenta = resposta.content.find(
        (bloco): bloco is Anthropic.ToolUseBlock => bloco.type === "tool_use",
      );

      if (!blocoFerramenta) {
        return { sucesso: false, erro: "A IA não retornou dados estruturados." };
      }

      const validado = dadosExtraidosComprovanteSchema.safeParse(blocoFerramenta.input);

      if (!validado.success) {
        return { sucesso: false, erro: "A IA retornou dados em um formato inesperado." };
      }

      const dados: DadosExtraidosComprovante = validado.data;

      return { sucesso: true, dados };
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : "Erro desconhecido ao chamar a IA.";
      return { sucesso: false, erro: mensagem };
    }
  }
}
