import type { ProvedorExtracaoIA, ResultadoExtracao } from "@/types";

/**
 * Provedor usado quando ANTHROPIC_API_KEY não está configurada (ex.: dev
 * local sem credenciais). Não tenta ler a imagem — devolve confiança zero
 * para todos os campos, forçando preenchimento 100% manual na tela de
 * confirmação. Mantém o fluxo de UI testável sem depender de uma API paga.
 */
export class MockExtracaoProvider implements ProvedorExtracaoIA {
  async extrair(): Promise<ResultadoExtracao> {
    return {
      sucesso: true,
      dados: {
        tipoDocumento: "comprovante",
        confiancaExtracao: 0,
        camposComBaixaConfianca: ["valor", "data", "favorecido", "descricao"],
      },
    };
  }
}
