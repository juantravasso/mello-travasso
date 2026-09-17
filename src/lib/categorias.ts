import type { CategoriaContaPagar, CategoriaContaReceber, FormaPagamento } from "@/types";

export const rotulosCategoriaPagar: Record<CategoriaContaPagar, string> = {
  aluguel: "Aluguel",
  aluguel_equipamentos: "Aluguel de equipamentos",
  fretes: "Fretes",
  pro_labore_marcio: "Retirada pró-labore Márcio",
  pro_labore_anderson: "Retirada pró-labore Anderson",
  custo_funcionario: "Custo com funcionário",
  custo_produtos: "Custo com produtos",
  manutencao_veiculos: "Manutenção de veículos",
  custo_transporte: "Custo com transporte (Uber, gasolina, etc.)",
  outros_custos_despesas: "Outros custos e despesas gerais",
};

export const categoriasPagar: CategoriaContaPagar[] = Object.keys(
  rotulosCategoriaPagar,
) as CategoriaContaPagar[];

export const rotulosCategoriaReceber: Record<CategoriaContaReceber, string> = {
  obras: "Obras",
  servicos_vans: "Serviços das vans",
  manutencao: "Manutenção",
};

export const categoriasReceber: CategoriaContaReceber[] = Object.keys(
  rotulosCategoriaReceber,
) as CategoriaContaReceber[];

export const rotulosFormaPagamento: Record<FormaPagamento, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  transferencia: "Transferência (TED/DOC)",
  boleto: "Boleto",
  cheque: "Cheque",
};

export const formasPagamento: FormaPagamento[] = Object.keys(rotulosFormaPagamento) as FormaPagamento[];

/** Formas de pagamento padrão que fazem sentido parcelar em várias datas de vencimento. */
export const FORMAS_PAGAMENTO_PARCELAVEIS = ["boleto", "cartao_credito"];
