import { MARCA } from "@/lib/marca";

// Quem opera a plataforma: aparece nos Termos de Uso e na Política de Privacidade (identificação do fornecedor e do
// encarregado de dados). Trocar por CNPJ quando houver; os textos leem daqui.
export const OPERADORA = {
  nome: "Juan Ferreira Travasso",
  /** Pessoa física enquanto não houver CNPJ. */
  documentoRotulo: "CPF",
  documento: "132.820.017-54",
  cidade: "Rio de Janeiro",
  uf: "RJ",
  email: MARCA.emailContato,
} as const;

/** Prazos e valores que os textos prometem e o sistema cumpre. Mudar aqui exige mudar a versão dos Termos. */
export const POLITICA = {
  /** Direito de arrependimento (CDC, art. 49): reembolso integral nos primeiros dias da contratação. */
  diasArrependimento: 7,
  /** Quanto tempo os dados ficam guardados depois que a conta deixa de ser paga. */
  mesesRetencao: 12,
  /** Prazo para atender pedidos de exclusão e de direitos do titular. */
  diasAtendimento: 15,
  /** Aviso antes de mudar preço de quem já assina. */
  diasAvisoReajuste: 30,
} as const;
