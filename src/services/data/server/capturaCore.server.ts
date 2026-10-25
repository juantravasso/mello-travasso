import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  destinoPrincipal,
  escalarRateios,
  ratearConta,
  type Rateio,
} from "@/lib/estoque/rateio";
import { dataDaBaixaAutomatica, deveBaixarSozinha, proximoVencimento } from "@/lib/formaPagamento";
import { capturaSchema } from "@/lib/validacao/captura";
import type { EntradaCaptura, ResultadoCaptura } from "@/types";
import {
  registrarMovimentoComTx,
  resolverProdutoComTx,
} from "./estoqueCore.server";
import { configuracaoDaForma } from "./formaPagamentoCore.server";
import { ErroDeNegocio } from "./resultado.server";

// Grava uma captura (comprovante ou nota fiscal) inteira numa transação: a conta (ou as parcelas), o rateio entre
// projetos e Depósito, os itens e a entrada de cada item no estoque do destino escolhido. Antes eram várias chamadas
// do navegador, e uma falha no meio deixava a conta sem itens. Recebe o contexto da SESSÃO: nada aqui confia em
// empresa vinda do cliente.

export interface ContextoCaptura {
  empresaId: string;
  nome: string;
}

const centavos = (v: number) => Math.round(v * 100 + 1e-6);

export async function registrarCaptura(
  ctx: ContextoCaptura,
  entrada: unknown,
): Promise<ResultadoCaptura> {
  const parsed = capturaSchema.safeParse(entrada);
  if (!parsed.success)
    throw new ErroDeNegocio(
      parsed.error.issues[0]?.message ?? "Dados inválidos.",
    );
  const dados: EntradaCaptura = parsed.data;

  const ehNota = dados.tipoDocumento === "nota_fiscal";
  if (!ehNota && dados.itens.length > 0)
    throw new ErroDeNegocio("Itens só valem para nota fiscal.");

  const parcelas =
    dados.parcelas && dados.parcelas.length > 1 ? dados.parcelas : undefined;
  if (
    parcelas &&
    centavos(parcelas.reduce((s, p) => s + p.valor, 0)) !==
      centavos(dados.valor)
  ) {
    throw new ErroDeNegocio(
      "A soma das parcelas é diferente do valor total. Ajuste o parcelamento.",
    );
  }

  // Todo destino citado precisa ser da empresa da sessão (projeto ou Depósito).
  const idsDestino = [
    ...new Set([dados.obraId, ...dados.itens.map((i) => i.obraId)]),
  ];
  const obras = await prisma.obra.findMany({
    where: { id: { in: idsDestino }, empresaId: ctx.empresaId },
    select: { id: true, ehDeposito: true },
  });
  if (obras.length !== idsDestino.length)
    throw new ErroDeNegocio("Projeto não encontrado.");
  if (!ehNota && obras.some((o) => o.ehDeposito))
    throw new ErroDeNegocio("Um comprovante simples precisa de um projeto.");

  if (dados.fornecedorId) {
    const fornecedor = await prisma.fornecedor.findFirst({
      where: { id: dados.fornecedorId, empresaId: ctx.empresaId },
      select: { id: true },
    });
    if (!fornecedor) throw new ErroDeNegocio("Fornecedor não encontrado.");
  }

  // Quanto da nota vai para cada destino. Um destino só dispensa o rateio: a conta já fica nele.
  const rateioBase: Rateio[] =
    dados.itens.length > 0 ? ratearConta(dados.itens, dados.valor) : [];
  const dividida = rateioBase.length > 1;
  const obraDaConta =
    dados.itens.length > 0
      ? (destinoPrincipal(rateioBase) ?? dados.obraId)
      : dados.obraId;

  const agora = new Date().toISOString();
  const hoje = agora.slice(0, 10);
  const parcelamentoId = parcelas ? randomUUID() : undefined;
  // O que a empresa configurou para esta forma de pagamento: baixa automática (dinheiro, PIX…) e dia fixo de vencimento
  // (cartão de crédito). Parcelas escolhidas à mão nunca baixam sozinhas nem mudam de data.
  const configuracao = await configuracaoDaForma(prisma, ctx.empresaId, dados.formaPagamento);
  const baixaSozinha = deveBaixarSozinha(
    { categoria: dados.categoria, formaPagamento: dados.formaPagamento, parcelada: Boolean(parcelas) },
    configuracao,
  );
  const vencimentoDaCompra =
    !baixaSozinha && !parcelas && configuracao.diaVencimento
      ? proximoVencimento(dados.data, configuracao.diaVencimento)
      : dados.data;
  const partes = parcelas ?? [
    { valor: dados.valor, dataVencimento: vencimentoDaCompra },
  ];

  return prisma.$transaction(
    async (tx) => {
      let primeiraContaId = "";
      for (const [indice, parte] of partes.entries()) {
        const conta = await tx.contaFinanceira.create({
          data: {
            empresaId: ctx.empresaId,
            tipo: "pagar",
            obraId: obraDaConta,
            valor: parte.valor,
            dataLancamento: hoje,
            dataVencimento: parte.dataVencimento,
            status: baixaSozinha ? "baixada" : "em_aberto",
            dataBaixa: baixaSozinha ? dataDaBaixaAutomatica(parte.dataVencimento, hoje) : undefined,
            favorecidoOuCliente: dados.favorecido,
            fornecedorId: dados.fornecedorId,
            descricao: parcelas
              ? `${dados.descricao} (parcela ${indice + 1}/${parcelas.length})`
              : dados.descricao,
            categoria: dados.categoria,
            formaPagamento: dados.formaPagamento,
            observacao: dados.observacao,
            comprovanteUrl: dados.comprovanteUrl,
            origemNotaFiscal: ehNota,
            // Vindo da câmera, alguém revisa e completa o cadastro depois — a menos que já esteja completo e a forma
            // de pagamento dê baixa sozinha (aí já nasce paga).
            precisaCompletarCadastro: !baixaSozinha,
            parcelamentoId,
            parcelaNumero: parcelas ? indice + 1 : undefined,
            parcelaTotal: parcelas ? parcelas.length : undefined,
            historico: [
              {
                id: randomUUID(),
                tipo: "criacao",
                usuario: ctx.nome,
                data: agora,
              },
              ...(baixaSozinha
                ? [{ id: randomUUID(), tipo: "baixa", usuario: ctx.nome, data: agora, detalhes: "Baixa automática pela forma de pagamento" }]
                : []),
            ] as unknown as Prisma.InputJsonValue,
            criadoEm: agora,
            atualizadoEm: agora,
          },
          select: { id: true },
        });
        if (indice === 0) primeiraContaId = conta.id;

        if (dividida) {
          const rateiosDaParte = parcelas
            ? escalarRateios(rateioBase, parte.valor)
            : rateioBase;
          await tx.rateioConta.createMany({
            data: rateiosDaParte.map((r) => ({
              contaFinanceiraId: conta.id,
              obraId: r.obraId,
              valor: r.valor,
            })),
          });
        }
      }

      // Os itens ficam na primeira conta (como já era com parcelamento): a compra é uma só, não uma por parcela.
      for (const item of dados.itens) {
        const criado = await tx.itemProduto.create({
          data: {
            empresaId: ctx.empresaId,
            contaFinanceiraId: primeiraContaId,
            obraId: item.obraId,
            descricao: item.descricao,
            quantidade: item.quantidade,
            unidade: item.unidade,
            valorUnitario: item.valorUnitario,
            valorTotal: item.valorTotal,
            dataCompra: dados.data,
            fornecedor: dados.favorecido,
            criadoEm: agora,
          },
        });
        const produto = await resolverProdutoComTx(
          tx,
          ctx.empresaId,
          item.descricao,
        );
        await tx.itemProduto.update({
          where: { id: criado.id },
          data: { produtoId: produto.id },
        });
        await registrarMovimentoComTx(tx, ctx.empresaId, {
          produtoId: produto.id,
          obraId: item.obraId,
          tipo: "entrada",
          quantidadeInformada: item.quantidade,
          valorUnitario: item.valorUnitario,
          origem: "item_produto",
          itemProdutoId: criado.id,
          lancadoPor: ctx.nome,
        });
      }

      return {
        contaId: primeiraContaId,
        contasCriadas: partes.length,
        itensCriados: dados.itens.length,
        rateios: dividida ? rateioBase : undefined,
      };
    },
    // Uma nota grande faz centenas de escritas em sequência; o padrão (5 s) cortaria a transação no meio.
    { timeout: 60_000, maxWait: 10_000 },
  );
}
