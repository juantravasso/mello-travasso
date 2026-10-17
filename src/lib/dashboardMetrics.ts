import type { CategoriaContaPagar, ContaFinanceira, Obra } from "@/types";
import { rotulosCategoriaPagar } from "./categorias";
import { valorDoDestino } from "./estoque/rateio";

export interface PontoFluxoMensal {
  mes: string; // rótulo curto, ex.: "Jan"
  entradas: number;
  saidas: number;
}

export interface FatiaCategoria {
  categoria: CategoriaContaPagar | "outros";
  rotulo: string;
  valor: number;
}

export interface ItemAtividade {
  id: string;
  descricao: string;
  quando: string; // ISO datetime
  tom: "success" | "info" | "danger";
}

const NOMES_MES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function chaveAnoMes(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

export function fluxoFinanceiroUltimosMeses(contas: ContaFinanceira[], meses = 6): PontoFluxoMensal[] {
  const hoje = new Date();
  const janelas: { chave: string; mes: string }[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    janelas.push({ chave: chaveAnoMes(data), mes: NOMES_MES[data.getMonth()] ?? "" });
  }

  const porChave = new Map<string, PontoFluxoMensal>(
    janelas.map((j) => [j.chave, { mes: j.mes, entradas: 0, saidas: 0 }]),
  );

  for (const conta of contas) {
    if (conta.status !== "baixada" || !conta.dataBaixa) continue;
    const chave = conta.dataBaixa.slice(0, 7);
    const ponto = porChave.get(chave);
    if (!ponto) continue;
    if (conta.tipo === "receber") ponto.entradas += conta.valor;
    else ponto.saidas += conta.valor;
  }

  return janelas.map((j) => porChave.get(j.chave) as PontoFluxoMensal);
}

export function gastosPorCategoria(
  contasPagar: ContaFinanceira[],
  rotuloDe: (categoria: string) => string = (c) => rotulosCategoriaPagar[c] ?? "Outros",
): FatiaCategoria[] {
  const totais = new Map<string, number>();
  for (const conta of contasPagar) {
    if (conta.status === "cancelada") continue;
    const chave = conta.categoria ?? "outros";
    totais.set(chave, (totais.get(chave) ?? 0) + conta.valor);
  }
  return Array.from(totais.entries())
    .map(([categoria, valor]) => ({
      categoria: categoria as CategoriaContaPagar,
      rotulo: categoria === "outros" ? "Outros" : rotuloDe(categoria),
      valor,
    }))
    .sort((a, b) => b.valor - a.valor);
}

export function variacaoPercentual(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

export function somaNoMes(contas: ContaFinanceira[], deslocamentoMeses: number): number {
  const hoje = new Date();
  const alvo = chaveAnoMes(new Date(hoje.getFullYear(), hoje.getMonth() - deslocamentoMeses, 1));
  return contas
    .filter((c) => c.status === "baixada" && c.dataBaixa?.slice(0, 7) === alvo)
    .reduce((soma, c) => soma + c.valor, 0);
}

export function contasProximas(contas: ContaFinanceira[], dias = 7): ContaFinanceira[] {
  const hoje = new Date();
  const limite = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dias);
  const hojeISO = hoje.toISOString().slice(0, 10);
  const limiteISO = limite.toISOString().slice(0, 10);
  return contas
    .filter((c) => c.status === "em_aberto" && c.dataVencimento >= hojeISO && c.dataVencimento <= limiteISO)
    .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento));
}

export function atividadeRecente(contas: ContaFinanceira[], limite = 5): ItemAtividade[] {
  return [...contas]
    .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm))
    .slice(0, limite)
    .map((conta) => {
      if (conta.status === "baixada") {
        return {
          id: conta.id,
          descricao: `${conta.tipo === "pagar" ? "Conta paga" : "Recebimento confirmado"}: ${conta.favorecidoOuCliente}`,
          quando: conta.atualizadoEm,
          tom: "success" as const,
        };
      }
      if (conta.status === "cancelada") {
        return {
          id: conta.id,
          descricao: `Lançamento cancelado: ${conta.favorecidoOuCliente}`,
          quando: conta.atualizadoEm,
          tom: "danger" as const,
        };
      }
      return {
        id: conta.id,
        descricao: `${conta.tipo === "pagar" ? "Novo gasto registrado" : "Nova conta a receber"}: ${conta.favorecidoOuCliente}`,
        quando: conta.criadoEm,
        tom: "info" as const,
      };
    });
}

export interface ProgressoObra {
  obra: Obra;
  gasto: number;
  percentual: number | null;
}

/** `transferidos`: gasto de cada projeto com material tirado do Depósito (já líquido de devoluções). */
export function progressoObras(obras: Obra[], contas: ContaFinanceira[], transferidos: Record<string, number> = {}): ProgressoObra[] {
  return obras
    .filter((o) => o.status === "em_andamento" && !o.ehDeposito)
    .map((obra) => {
      const gasto =
        contas
          .filter((c) => c.tipo === "pagar" && c.status === "baixada")
          .reduce((soma, c) => soma + valorDoDestino(c, obra.id), 0) + (transferidos[obra.id] ?? 0);
      return {
        obra,
        gasto,
        percentual: obra.orcamentoPrevisto ? Math.min(100, (gasto / obra.orcamentoPrevisto) * 100) : null,
      };
    });
}
