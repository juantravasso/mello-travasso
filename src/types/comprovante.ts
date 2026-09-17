export type TipoDocumentoCapturado = "comprovante" | "nota_fiscal";

/**
 * Item individual extraído de uma nota fiscal pela IA.
 * Campos ausentes (undefined) indicam baixa confiança — devem ficar em
 * branco na UI para revisão manual em vez de assumir um valor.
 */
export interface ItemNotaFiscalExtraido {
  descricao?: string;
  quantidade?: number;
  unidade?: string;
  valorUnitario?: number;
  valorTotal?: number;
}

/**
 * Resultado bruto retornado pelo provedor de IA (OCR/Vision).
 * Todo campo é opcional: a IA nunca deve "inventar" um valor com baixa
 * confiança — o campo fica ausente e a UI exige preenchimento manual.
 */
export interface DadosExtraidosComprovante {
  tipoDocumento: TipoDocumentoCapturado;
  valor?: number;
  data?: string; // ISO date, quando reconhecida
  favorecido?: string;
  cnpjFavorecido?: string;
  descricao?: string;
  categoriaSugerida?: string;
  itens?: ItemNotaFiscalExtraido[]; // presente quando tipoDocumento = "nota_fiscal"
  confiancaExtracao: number; // 0 a 1
  camposComBaixaConfianca: string[]; // nomes dos campos que a UI deve destacar p/ revisão
}

export interface SolicitacaoExtracao {
  imagemBase64: string; // sem o prefixo "data:image/...;base64,"
  mimeType: "image/jpeg" | "image/png" | "image/webp";
}

export interface ResultadoExtracao {
  sucesso: boolean;
  dados?: DadosExtraidosComprovante;
  erro?: string;
}

/**
 * Contrato que qualquer provedor de IA (Anthropic, mock, etc.) deve implementar.
 * Mantém a UI e as rotas de API independentes do provedor concreto.
 */
export interface ProvedorExtracaoIA {
  extrair(solicitacao: SolicitacaoExtracao): Promise<ResultadoExtracao>;
}
