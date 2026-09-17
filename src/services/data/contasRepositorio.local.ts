import type {
  BaixarContaInput,
  ContaFinanceira,
  FiltrosContaFinanceira,
  NovaContaFinanceiraInput,
  TipoConta,
} from "@/types";
import { agoraISO, gerarId, lerBanco, salvarBanco } from "./localDb";
import type { ContasRepositorio } from "./repositorios";

function corresponde(
  conta: ContaFinanceira,
  filtros?: FiltrosContaFinanceira & { tipo?: TipoConta },
): boolean {
  if (!filtros) return true;
  if (filtros.tipo && conta.tipo !== filtros.tipo) return false;
  if (filtros.obraId && conta.obraId !== filtros.obraId) return false;
  if (filtros.status && conta.status !== filtros.status) return false;
  if (filtros.categoria && conta.categoria !== filtros.categoria) return false;
  if (
    filtros.precisaCompletarCadastro !== undefined &&
    conta.precisaCompletarCadastro !== filtros.precisaCompletarCadastro
  ) {
    return false;
  }
  if (filtros.dataInicio && conta.dataVencimento < filtros.dataInicio) return false;
  if (filtros.dataFim && conta.dataVencimento > filtros.dataFim) return false;
  if (filtros.busca) {
    const alvo = `${conta.favorecidoOuCliente} ${conta.descricao}`.toLowerCase();
    if (!alvo.includes(filtros.busca.toLowerCase())) return false;
  }
  return true;
}

export class ContasRepositorioLocal implements ContasRepositorio {
  async listar(filtros?: FiltrosContaFinanceira & { tipo?: TipoConta }): Promise<ContaFinanceira[]> {
    return lerBanco()
      .contas.filter((conta) => corresponde(conta, filtros))
      .sort((a, b) => b.dataVencimento.localeCompare(a.dataVencimento));
  }

  async obterPorId(id: string): Promise<ContaFinanceira | null> {
    return lerBanco().contas.find((conta) => conta.id === id) ?? null;
  }

  async criar(input: NovaContaFinanceiraInput): Promise<ContaFinanceira> {
    const banco = lerBanco();
    const agora = agoraISO();
    const novaConta: ContaFinanceira = {
      ...input,
      id: gerarId("conta"),
      status: "em_aberto",
      criadoEm: agora,
      atualizadoEm: agora,
    };
    banco.contas.push(novaConta);
    salvarBanco(banco);
    return novaConta;
  }

  async atualizar(id: string, input: Partial<NovaContaFinanceiraInput>): Promise<ContaFinanceira> {
    const banco = lerBanco();
    const indice = banco.contas.findIndex((conta) => conta.id === id);
    if (indice === -1) throw new Error(`Conta ${id} não encontrada`);
    const existente = banco.contas[indice];
    if (!existente) throw new Error(`Conta ${id} não encontrada`);
    const atualizada: ContaFinanceira = { ...existente, ...input, id, atualizadoEm: agoraISO() };
    banco.contas[indice] = atualizada;
    salvarBanco(banco);
    return atualizada;
  }

  async baixar(input: BaixarContaInput): Promise<ContaFinanceira> {
    const banco = lerBanco();
    const indice = banco.contas.findIndex((conta) => conta.id === input.contaId);
    if (indice === -1) throw new Error(`Conta ${input.contaId} não encontrada`);
    const existente = banco.contas[indice];
    if (!existente) throw new Error(`Conta ${input.contaId} não encontrada`);
    const atualizada: ContaFinanceira = {
      ...existente,
      status: "baixada",
      dataBaixa: input.dataBaixa,
      atualizadoEm: agoraISO(),
    };
    banco.contas[indice] = atualizada;
    salvarBanco(banco);
    return atualizada;
  }
}
