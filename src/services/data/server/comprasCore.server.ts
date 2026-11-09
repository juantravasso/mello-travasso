import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { chaveDoItem, chaveFornecedor, formatarNumeroCompra, sugerirProduto, totalDoItem, totaisDaCompra } from "@/lib/compras";
import { normalizarBusca } from "@/lib/rede/texto";
import {
  cancelarCompraSchema,
  compraSchema,
  filtrosCompraSchema,
  idCompraSchema,
  sugestaoSchema,
} from "@/lib/validacao/compra";
import type {
  CompraDetalhe,
  CompraResumo,
  EntradaCaptura,
  EntradaCompra,
  ItemCompra,
  ListaCompras,
  ParcelaCompra,
  ResultadoEfetivacao,
  SugestaoProduto,
} from "@/types";
import { registrarCaptura } from "./capturaCore.server";
import { reverterEstoqueDaConta } from "./estoqueCore.server";
import { ErroDeNegocio } from "./resultado.server";

// Compras: cabeçalho + itens que nascem rascunho (da foto ou digitados), têm os itens identificados com o catálogo e só
// "Efetivar" gera as contas a pagar e a entrada no estoque (reaproveitando a gravação da captura, na mesma transação).
// Recebe o contexto da SESSÃO: nada aqui confia em empresa vinda do cliente, e os totais são sempre recalculados.

export interface ContextoCompra {
  empresaId: string;
  nome: string;
}

const centavos = (v: number) => Math.round(v * 100 + 1e-6);

function lerParcelas(json: Prisma.JsonValue): ParcelaCompra[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((p) => {
    if (!p || typeof p !== "object" || Array.isArray(p)) return [];
    const { valor, dataVencimento } = p as Record<string, unknown>;
    return typeof valor === "number" && typeof dataVencimento === "string" ? [{ valor, dataVencimento }] : [];
  });
}

type ItemBanco = {
  id: string;
  descricao: string;
  codigoFornecedor: string | null;
  ncm: string | null;
  unidade: string | null;
  quantidade: number;
  valorUnitario: number;
  desconto: number;
  valorTotal: number;
  obraId: string;
  produtoId: string | null;
};

function paraItem(i: ItemBanco): ItemCompra {
  return {
    id: i.id,
    descricao: i.descricao,
    codigoFornecedor: i.codigoFornecedor ?? undefined,
    ncm: i.ncm ?? undefined,
    unidade: i.unidade ?? undefined,
    quantidade: i.quantidade,
    valorUnitario: i.valorUnitario,
    desconto: i.desconto,
    valorTotal: i.valorTotal,
    obraId: i.obraId,
    produtoId: i.produtoId ?? undefined,
  };
}

/** Confere que tudo o que a entrada cita é da empresa da sessão e recalcula os totais dos itens. */
async function validarEntrada(ctx: ContextoCompra, entrada: unknown) {
  const parsed = compraSchema.safeParse(entrada);
  if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const dados: EntradaCompra = parsed.data;

  const idsObra = [...new Set([dados.obraId, ...dados.itens.map((i) => i.obraId)])];
  const obras = await prisma.obra.count({ where: { id: { in: idsObra }, empresaId: ctx.empresaId } });
  if (obras !== idsObra.length) throw new ErroDeNegocio("Projeto não encontrado.");

  if (dados.fornecedorId) {
    const f = await prisma.fornecedor.findFirst({ where: { id: dados.fornecedorId, empresaId: ctx.empresaId }, select: { id: true } });
    if (!f) throw new ErroDeNegocio("Fornecedor não encontrado.");
  }

  const idsProduto = [...new Set(dados.itens.flatMap((i) => (i.produtoId ? [i.produtoId] : [])))];
  if (idsProduto.length > 0) {
    const produtos = await prisma.produto.count({ where: { id: { in: idsProduto }, empresaId: ctx.empresaId } });
    if (produtos !== idsProduto.length) throw new ErroDeNegocio("Produto não encontrado.");
  }

  const itens = dados.itens.map((i) => ({ ...i, valorTotal: totalDoItem(i.quantidade, i.valorUnitario, i.desconto) }));
  const totais = totaisDaCompra(itens, dados.frete, dados.seguro, dados.outrasDespesas);
  return { dados, itens, totais };
}

async function gravarVinculos(
  tx: Prisma.TransactionClient,
  empresaId: string,
  fornecedorId: string | undefined,
  fornecedorNome: string,
  itens: Pick<ItemCompra, "descricao" | "codigoFornecedor" | "produtoId">[],
): Promise<void> {
  const fornecedorChave = chaveFornecedor(fornecedorId, fornecedorNome);
  const agora = new Date().toISOString();
  for (const item of itens) {
    if (!item.produtoId) continue;
    const chave = chaveDoItem(item.codigoFornecedor, item.descricao);
    await tx.vinculoProduto.upsert({
      where: { empresaId_fornecedorChave_chave: { empresaId, fornecedorChave, chave } },
      create: { empresaId, fornecedorChave, chave, produtoId: item.produtoId, atualizadoEm: agora },
      update: { produtoId: item.produtoId, atualizadoEm: agora },
    });
  }
}

export async function salvarCompra(ctx: ContextoCompra, entrada: unknown, id?: string): Promise<{ id: string; numero: number }> {
  if (id !== undefined && !idCompraSchema.safeParse(id).success) throw new ErroDeNegocio("Compra não encontrada.");
  const { dados, itens, totais } = await validarEntrada(ctx, entrada);
  const agora = new Date().toISOString();

  const campos = {
    origem: dados.origem,
    fornecedorId: dados.fornecedorId ?? null,
    fornecedorNome: dados.fornecedorNome,
    numeroNf: dados.numeroNf ?? null,
    serie: dados.serie ?? null,
    chaveAcesso: dados.chaveAcesso ?? null,
    dataEmissao: dados.dataEmissao ?? null,
    dataCompra: dados.dataCompra,
    obraId: dados.obraId,
    categoria: dados.categoria ?? null,
    formaPagamento: dados.formaPagamento ?? null,
    frete: dados.frete,
    seguro: dados.seguro,
    outrasDespesas: dados.outrasDespesas,
    descontoTotal: totais.descontoTotal,
    valorProdutos: totais.valorProdutos,
    valorTotal: totais.valorTotal,
    parcelas: (dados.parcelas ?? []) as unknown as Prisma.InputJsonValue,
    observacao: dados.observacao ?? null,
    comprovanteUrl: dados.comprovanteUrl,
    atualizadoEm: agora,
  };
  const dadosDosItens = (compraId: string) =>
    itens.map((i, ordem) => ({
      compraId,
      ordem,
      descricao: i.descricao,
      codigoFornecedor: i.codigoFornecedor || null,
      ncm: i.ncm || null,
      unidade: i.unidade || null,
      quantidade: i.quantidade,
      valorUnitario: i.valorUnitario,
      desconto: i.desconto,
      valorTotal: i.valorTotal,
      obraId: i.obraId,
      produtoId: i.produtoId ?? null,
    }));

  // O número é sequencial por empresa: se duas compras nascem juntas, a restrição única derruba uma e ela tenta de novo.
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          let compraId: string;
          let numero: number;
          if (id) {
            const atual = await tx.compra.findFirst({ where: { id, empresaId: ctx.empresaId }, select: { id: true, numero: true, status: true } });
            if (!atual) throw new ErroDeNegocio("Compra não encontrada.");
            if (atual.status !== "rascunho") throw new ErroDeNegocio("Só dá para editar uma compra que ainda não foi efetivada.");
            await tx.compra.update({ where: { id }, data: campos });
            await tx.compraItem.deleteMany({ where: { compraId: id } });
            compraId = id;
            numero = atual.numero;
          } else {
            const ultimo = await tx.compra.aggregate({ where: { empresaId: ctx.empresaId }, _max: { numero: true } });
            numero = (ultimo._max.numero ?? 0) + 1;
            const criada = await tx.compra.create({
              data: { ...campos, empresaId: ctx.empresaId, numero, status: "rascunho", criadoPor: ctx.nome, criadoEm: agora },
              select: { id: true },
            });
            compraId = criada.id;
          }
          await tx.compraItem.createMany({ data: dadosDosItens(compraId) });
          await gravarVinculos(tx, ctx.empresaId, dados.fornecedorId, dados.fornecedorNome, itens);
          return { id: compraId, numero };
        },
        { timeout: 30_000, maxWait: 10_000 },
      );
    } catch (erro) {
      if (!id && erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002" && tentativa < 3) continue;
      throw erro;
    }
  }
  throw new ErroDeNegocio("Não foi possível numerar a compra. Tente de novo.");
}

export async function obterCompra(ctx: ContextoCompra, id: string): Promise<CompraDetalhe | null> {
  if (!idCompraSchema.safeParse(id).success) return null;
  const c = await prisma.compra.findFirst({
    where: { id, empresaId: ctx.empresaId },
    include: { itens: { orderBy: { ordem: "asc" } } },
  });
  if (!c) return null;
  return {
    id: c.id,
    numero: c.numero,
    status: c.status,
    origem: c.origem === "foto" ? "foto" : "manual",
    dataCompra: c.dataCompra,
    dataEmissao: c.dataEmissao ?? undefined,
    numeroNf: c.numeroNf ?? undefined,
    fornecedorNome: c.fornecedorNome,
    valorTotal: c.valorTotal,
    fornecedorId: c.fornecedorId ?? undefined,
    serie: c.serie ?? undefined,
    chaveAcesso: c.chaveAcesso ?? undefined,
    obraId: c.obraId,
    categoria: c.categoria ?? undefined,
    formaPagamento: c.formaPagamento ?? undefined,
    frete: c.frete,
    seguro: c.seguro,
    outrasDespesas: c.outrasDespesas,
    descontoTotal: c.descontoTotal,
    valorProdutos: c.valorProdutos,
    parcelas: lerParcelas(c.parcelas),
    observacao: c.observacao ?? undefined,
    comprovanteUrl: c.comprovanteUrl,
    contaFinanceiraId: c.contaFinanceiraId ?? undefined,
    motivoCancelamento: c.motivoCancelamento ?? undefined,
    itens: c.itens.map(paraItem),
  };
}

export async function listarCompras(ctx: ContextoCompra, filtros: unknown): Promise<ListaCompras> {
  const parsed = filtrosCompraSchema.safeParse(filtros ?? {});
  if (!parsed.success) throw new ErroDeNegocio("Filtro inválido.");
  const f = parsed.data;
  const termo = f.busca ? normalizarBusca(f.busca).replace(/[%_\\]/g, " ").trim() : "";
  const numero = /^\d{1,9}$/.test(termo) ? Number(termo) : null;

  const linhas = await prisma.compra.findMany({
    where: {
      empresaId: ctx.empresaId,
      ...(f.status ? { status: f.status } : {}),
      ...(f.de || f.ate ? { dataCompra: { ...(f.de ? { gte: f.de } : {}), ...(f.ate ? { lte: f.ate } : {}) } } : {}),
      ...(termo
        ? {
            OR: [
              { fornecedorNome: { contains: termo, mode: "insensitive" } },
              { numeroNf: { contains: termo, mode: "insensitive" } },
              ...(numero !== null ? [{ numero }] : []),
            ],
          }
        : {}),
    },
    orderBy: [{ dataCompra: "desc" }, { numero: "desc" }],
    take: 300,
    select: {
      id: true,
      numero: true,
      status: true,
      origem: true,
      dataCompra: true,
      dataEmissao: true,
      numeroNf: true,
      fornecedorNome: true,
      valorTotal: true,
      parcelas: true,
      contaFinanceiraId: true,
      itens: { select: { produtoId: true } },
    },
  });

  // Situação dos vencimentos das compras efetivadas: a conta principal e as demais parcelas do mesmo parcelamento.
  const idsPrincipais = linhas.flatMap((l) => (l.status === "efetivada" && l.contaFinanceiraId ? [l.contaFinanceiraId] : []));
  const principais = idsPrincipais.length
    ? await prisma.contaFinanceira.findMany({ where: { id: { in: idsPrincipais }, empresaId: ctx.empresaId }, select: { id: true, parcelamentoId: true } })
    : [];
  const idsParcelamento = principais.flatMap((p) => (p.parcelamentoId ? [p.parcelamentoId] : []));
  const contas = idsPrincipais.length
    ? await prisma.contaFinanceira.findMany({
        where: { empresaId: ctx.empresaId, OR: [{ id: { in: idsPrincipais } }, ...(idsParcelamento.length ? [{ parcelamentoId: { in: idsParcelamento } }] : [])] },
        select: { id: true, parcelamentoId: true, valor: true, status: true },
      })
    : [];
  const parcelamentoDaPrincipal = new Map(principais.map((p) => [p.id, p.parcelamentoId]));

  const compras: CompraResumo[] = linhas.map((l) => {
    let abertos = 0;
    let pagos = 0;
    let quantas = 0;
    if (l.status === "efetivada" && l.contaFinanceiraId) {
      const parcelamento = parcelamentoDaPrincipal.get(l.contaFinanceiraId);
      for (const c of contas) {
        if (c.id !== l.contaFinanceiraId && !(parcelamento && c.parcelamentoId === parcelamento)) continue;
        if (c.status === "cancelada") continue;
        quantas++;
        if (c.status === "baixada") pagos += c.valor;
        else abertos += c.valor;
      }
    }
    return {
      id: l.id,
      numero: l.numero,
      status: l.status,
      origem: l.origem === "foto" ? "foto" : "manual",
      dataCompra: l.dataCompra,
      dataEmissao: l.dataEmissao ?? undefined,
      numeroNf: l.numeroNf ?? undefined,
      fornecedorNome: l.fornecedorNome,
      valorTotal: l.valorTotal,
      quantidadeItens: l.itens.length,
      itensSemProduto: l.itens.filter((i) => !i.produtoId).length,
      parcelas: quantas || lerParcelas(l.parcelas).length || 1,
      vencimentosAbertos: abertos,
      vencimentosPagos: pagos,
    };
  });

  const validas = compras.filter((c) => c.status !== "cancelada");
  const soma = (v: number[]) => Math.round(v.reduce((a, b) => a + b, 0) * 100) / 100;
  return {
    compras,
    totais: {
      quantidade: validas.length,
      valorCompras: soma(validas.map((c) => c.valorTotal)),
      valorAberto: soma(validas.map((c) => c.vencimentosAbertos)),
      valorPago: soma(validas.map((c) => c.vencimentosPagos)),
    },
  };
}

/** Sugere o produto de cada item pela memória do fornecedor e, na falta dela, pelo nome. Só lê, nunca grava. */
export async function sugerirIdentificacao(ctx: ContextoCompra, entrada: unknown): Promise<(SugestaoProduto | null)[]> {
  const parsed = sugestaoSchema.safeParse(entrada);
  if (!parsed.success) throw new ErroDeNegocio("Dados inválidos.");
  const d = parsed.data;
  const [produtos, vinculosBanco] = await Promise.all([
    prisma.produto.findMany({ where: { empresaId: ctx.empresaId }, select: { id: true, nome: true } }),
    prisma.vinculoProduto.findMany({
      where: { empresaId: ctx.empresaId, fornecedorChave: chaveFornecedor(d.fornecedorId, d.fornecedorNome) },
      select: { chave: true, produtoId: true },
    }),
  ]);
  const vinculos = new Map(vinculosBanco.map((v) => [v.chave, v.produtoId]));
  const nomes = new Map(produtos.map((p) => [p.id, p.nome]));
  return d.itens.map((item) => {
    const s = sugerirProduto(item, vinculos, produtos);
    return s ? { produtoId: s.produtoId, produtoNome: nomes.get(s.produtoId) ?? "", motivo: s.motivo } : null;
  });
}

export async function efetivarCompra(ctx: ContextoCompra, id: string): Promise<ResultadoEfetivacao> {
  if (!idCompraSchema.safeParse(id).success) throw new ErroDeNegocio("Compra não encontrada.");
  const compra = await prisma.compra.findFirst({
    where: { id, empresaId: ctx.empresaId },
    include: { itens: { orderBy: { ordem: "asc" } } },
  });
  if (!compra) throw new ErroDeNegocio("Compra não encontrada.");
  if (compra.status !== "rascunho") throw new ErroDeNegocio("Esta compra já foi efetivada ou cancelada.");
  if (compra.itens.length === 0) throw new ErroDeNegocio("Adicione ao menos um item.");

  const semProduto = compra.itens.filter((i) => !i.produtoId).length;
  if (semProduto > 0) {
    throw new ErroDeNegocio(`Identifique os produtos de ${semProduto} item(ns) antes de efetivar.`);
  }
  if (compra.valorTotal <= 0) throw new ErroDeNegocio("O valor total da compra precisa ser maior que zero.");

  const parcelas = lerParcelas(compra.parcelas);
  if (parcelas.length > 1 && centavos(parcelas.reduce((s, p) => s + p.valor, 0)) !== centavos(compra.valorTotal)) {
    throw new ErroDeNegocio("A soma das parcelas é diferente do valor total da compra. Ajuste o parcelamento.");
  }

  const referencia = [`Compra ${formatarNumeroCompra(compra.numero)}`, compra.numeroNf ? `NF ${compra.numeroNf}` : null].filter(Boolean).join(" · ");
  const entrada: EntradaCaptura = {
    tipoDocumento: "nota_fiscal",
    obraId: compra.obraId,
    valor: compra.valorTotal,
    data: compra.dataCompra,
    favorecido: compra.fornecedorNome,
    fornecedorId: compra.fornecedorId ?? undefined,
    descricao: referencia,
    categoria: compra.categoria ?? undefined,
    formaPagamento: compra.formaPagamento ?? undefined,
    observacao: compra.observacao ?? undefined,
    comprovanteUrl: compra.comprovanteUrl,
    // O custo que entra no estoque é o líquido (já com o desconto do item).
    itens: compra.itens.map((i) => ({
      descricao: i.descricao,
      quantidade: i.quantidade,
      unidade: i.unidade ?? undefined,
      valorUnitario: i.quantidade > 0 ? Math.round((i.valorTotal / i.quantidade) * 1_000_000) / 1_000_000 : i.valorUnitario,
      valorTotal: i.valorTotal,
      obraId: i.obraId,
    })),
    parcelas: parcelas.length > 1 ? parcelas : undefined,
  };

  const resultado = await registrarCaptura(ctx, entrada, {
    produtoPorItem: compra.itens.map((i) => i.produtoId ?? undefined),
    aposGravar: async (tx, r) => {
      const marcada = await tx.compra.updateMany({
        where: { id: compra.id, empresaId: ctx.empresaId, status: "rascunho" },
        data: { status: "efetivada", contaFinanceiraId: r.contaId, atualizadoEm: new Date().toISOString() },
      });
      // Duas pessoas efetivando a mesma compra: a segunda desfaz tudo (a transação inteira volta atrás).
      if (marcada.count === 0) throw new ErroDeNegocio("Esta compra já foi efetivada por outra pessoa.");
      await gravarVinculos(tx, ctx.empresaId, compra.fornecedorId ?? undefined, compra.fornecedorNome, compra.itens.map(paraItem));
    },
  });
  return { compraId: compra.id, contasCriadas: resultado.contasCriadas };
}

export async function cancelarCompra(ctx: ContextoCompra, entrada: unknown): Promise<{ avisoEstoque?: string }> {
  const parsed = cancelarCompraSchema.safeParse(entrada);
  if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { id, motivo } = parsed.data;
  const compra = await prisma.compra.findFirst({ where: { id, empresaId: ctx.empresaId }, select: { id: true, status: true, contaFinanceiraId: true } });
  if (!compra) throw new ErroDeNegocio("Compra não encontrada.");
  if (compra.status === "cancelada") throw new ErroDeNegocio("Esta compra já foi cancelada.");

  const agora = new Date().toISOString();
  if (compra.status === "rascunho") {
    await prisma.compra.updateMany({
      where: { id, empresaId: ctx.empresaId, status: "rascunho" },
      data: { status: "cancelada", motivoCancelamento: motivo, atualizadoEm: agora },
    });
    return {};
  }

  const principal = compra.contaFinanceiraId
    ? await prisma.contaFinanceira.findFirst({ where: { id: compra.contaFinanceiraId, empresaId: ctx.empresaId }, select: { id: true, parcelamentoId: true } })
    : null;
  const contas = principal
    ? await prisma.contaFinanceira.findMany({
        where: { empresaId: ctx.empresaId, ...(principal.parcelamentoId ? { parcelamentoId: principal.parcelamentoId } : { id: principal.id }) },
        select: { id: true, status: true, historico: true },
      })
    : [];
  if (contas.some((c) => c.status === "baixada")) {
    throw new ErroDeNegocio("Há parcela já paga. Desfaça a baixa em Contas a pagar antes de cancelar a compra.");
  }

  await prisma.$transaction(async (tx) => {
    const marcada = await tx.compra.updateMany({
      where: { id, empresaId: ctx.empresaId, status: "efetivada" },
      data: { status: "cancelada", motivoCancelamento: motivo, atualizadoEm: agora },
    });
    // Dois cancelamentos juntos estornariam o estoque duas vezes: só o primeiro passa daqui.
    if (marcada.count === 0) throw new ErroDeNegocio("Esta compra já foi cancelada.");
    for (const c of contas) {
      if (c.status !== "em_aberto") continue;
      const historico = Array.isArray(c.historico) ? c.historico : [];
      await tx.contaFinanceira.update({
        where: { id: c.id },
        data: {
          status: "cancelada",
          motivoCancelamento: motivo,
          historico: [...historico, { id: randomUUID(), tipo: "cancelamento", usuario: ctx.nome, data: agora, detalhes: motivo }] as unknown as Prisma.InputJsonValue,
          atualizadoEm: agora,
        },
      });
    }
  });

  // Mesmo critério do cancelamento de conta: melhor esforço, nunca desfaz o cancelamento por causa do estoque.
  if (!principal) return {};
  try {
    const { naoRevertidos } = await reverterEstoqueDaConta(ctx.empresaId, ctx.nome, principal.id);
    if (naoRevertidos > 0) return { avisoEstoque: "Parte do estoque já foi consumida — ajuste manual necessário para esses itens." };
  } catch (erro) {
    console.error("[compras] falha ao reverter estoque no cancelamento", id, erro);
    return { avisoEstoque: "Não foi possível conferir o estoque automaticamente — confira manualmente." };
  }
  return {};
}
