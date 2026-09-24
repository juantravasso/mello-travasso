export type TipoMovimentoEstoque = "entrada" | "saida" | "ajuste";

export interface MovimentoEstoque {
  id: string;
  produtoId: string;
  obraId: string;
  tipo: TipoMovimentoEstoque;
  quantidade: number; // sempre > 0; o efeito no saldo depende de `tipo`
  valorUnitario?: number;
  origem: "manual" | "item_produto";
  itemProdutoId?: string;
  /** Nome do usuário da sessão que registrou — não é o usuário atual, é quem lançou. */
  lancadoPor: string;
  observacao?: string;
  criadoEm: string;
}

/**
 * Entrada de usuário para o formulário de movimentação manual. `quantidade`
 * tem sentido diferente por tipo: para "ajuste" é o saldo final desejado
 * (o servidor calcula a diferença), para "entrada"/"saida" é a própria
 * quantidade a somar/subtrair — ver RF-04 do PRD. `saldoEsperado` só se aplica
 * a "ajuste": o saldo que a UI mostrou ao usuário, usado como precondição
 * otimista contra uma movimentação concorrente.
 */
export interface NovoMovimentoInput {
  produtoId: string;
  obraId: string;
  tipo: TipoMovimentoEstoque;
  quantidade: number;
  saldoEsperado?: number;
  valorUnitario?: number;
  observacao?: string;
}
