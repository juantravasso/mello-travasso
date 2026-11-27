import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ACESSO, temAlgumModulo, type ModuloChave } from "@/lib/auth/modulos";
import { categoriasPagar, categoriasReceber, formasPagamento, rotulosCategoriaPagar, rotulosCategoriaReceber, rotulosFormaPagamento } from "@/lib/categorias";
import { urlDoSite } from "@/lib/rede/site";
import type { ContaFinanceira, TipoConta } from "@/types";
import * as contas from "../contasCore.server";
import { citar, contaPelaRef, data, ferramenta, PedidoIncompleto, real, type ContextoFerramenta, type Ferramenta } from "./ferramentas.server";

// Ferramentas de ESCRITA do assistente. Nenhuma grava ao ser chamada pela IA: `executar` valida tudo (acesso, projeto,
// conta em aberto, duplicidade) e devolve uma proposta com o texto que a pessoa confirma com SIM. Só a confirmação,
// conferida pelo sistema (assistenteCore), chama `efetivar`, que grava pelo MESMO núcleo do site (contasCore).

const ESCREVER: Record<TipoConta, readonly ModuloChave[]> = { pagar: ACESSO.contasPagarEscrever, receber: ACESSO.contasReceberEscrever };
const ESCREVER_CONTAS = [...ACESSO.contasPagarEscrever, ...ACESSO.contasReceberEscrever] as const;
const CATEGORIAS = [...categoriasPagar, ...categoriasReceber] as [string, ...string[]];
const FORMAS = formasPagamento as [string, ...string[]];

const dataBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const semAcento = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
const rotuloCategoria = (c: string) => (rotulosCategoriaPagar as Record<string, string>)[c] ?? (rotulosCategoriaReceber as Record<string, string>)[c] ?? c;
const link = (c: { id: string; tipo: string }) => `${urlDoSite()}/contas-a-${c.tipo === "pagar" ? "pagar" : "receber"}/${c.id}`;

function exigirEscrita(ctx: ContextoFerramenta, tipo: TipoConta): void {
  if (ctx.somenteLeitura) {
    throw new PedidoIncompleto("A empresa está em modo somente leitura (o teste acabou): não dá para lançar nem alterar nada. Explique isso ao usuário e diga que as consultas continuam valendo.");
  }
  if (!temAlgumModulo(ctx.contas, ESCREVER[tipo])) {
    throw new PedidoIncompleto(`Este usuário não tem permissão para lançar ou alterar contas a ${tipo}. Diga isso ao usuário.`);
  }
}

/** Projeto do lançamento: pelo nome dito, ou o único ativo. Ambíguo ou ausente vira pergunta (com as opções). */
async function resolverProjeto(ctx: ContextoFerramenta, nome: string | undefined, tipo: TipoConta): Promise<{ id: string; nome: string }> {
  const obras = await prisma.obra.findMany({
    where: { empresaId: ctx.contas.empresaId, OR: [{ ehDeposito: false, status: { in: ["em_andamento", "pausada"] } }, ...(tipo === "pagar" ? [{ ehDeposito: true }] : [])] },
    orderBy: { atualizadoEm: "desc" },
    select: { id: true, nome: true, ehDeposito: true },
    take: 200,
  });
  const projetos = obras.filter((o) => !o.ehDeposito);
  const opcoes = (lista: typeof obras) => lista.slice(0, 10).map((o) => o.nome).join("; ");
  if (nome) {
    const n = semAcento(nome);
    const achados = obras.filter((o) => semAcento(o.nome) === n);
    const parecidos = achados.length > 0 ? achados : obras.filter((o) => semAcento(o.nome).includes(n) || n.includes(semAcento(o.nome)));
    if (parecidos.length === 1) return { id: parecidos[0].id, nome: parecidos[0].nome };
    if (parecidos.length > 1) throw new PedidoIncompleto(`Mais de um projeto combina com "${nome}". Pergunte qual: ${opcoes(parecidos)}.`);
    throw new PedidoIncompleto(`Nenhum projeto ativo chamado "${nome}". Pergunte qual destes: ${opcoes(obras)}.`);
  }
  if (projetos.length === 1 && (tipo === "receber" || obras.length === 1)) return { id: projetos[0].id, nome: projetos[0].nome };
  if (obras.length === 0 || (tipo === "receber" && projetos.length === 0)) {
    throw new PedidoIncompleto("A empresa não tem projeto ativo, e todo lançamento precisa de um. Diga ao usuário para cadastrar um projeto no app.");
  }
  throw new PedidoIncompleto(`Pergunte ao usuário em qual projeto lançar. Opções: ${opcoes(obras)}.`);
}

/** Conta da conversa pela ref, em aberto e de um tipo que a pessoa pode alterar. */
async function contaAbertaPelaRef(ctx: ContextoFerramenta, ref: string): Promise<ContaFinanceira> {
  const conta = await contaPelaRef(ctx.contas, ref);
  if (!conta) throw new PedidoIncompleto("Conta não encontrada com essa ref. Procure de novo com listar_contas.");
  exigirEscrita(ctx, conta.tipo);
  if (conta.status !== "em_aberto") {
    throw new PedidoIncompleto(`Essa conta já está ${conta.status === "baixada" ? (conta.tipo === "pagar" ? "paga" : "recebida") : "cancelada"}; não dá para alterar. Diga isso ao usuário.`);
  }
  return conta;
}

/** Palavras que não identificam uma conta (não contam para o aviso de duplicidade). */
const PALAVRAS_COMUNS = new Set(["cliente", "conta", "servico", "pagamento", "compra", "referente", "nota", "fiscal", "informado"]);

const linhaConta = (c: ContaFinanceira) => `${c.favorecidoOuCliente} · ${c.descricao} · ${real(c.valor)} · vence ${dataBr(c.dataVencimento)}`;
const CONFIRMA = "Responda *SIM* para confirmar ou *NÃO* para cancelar.";

// ---------------------------------------------------------------------------------------------------------------------

const dadosLancamento = z
  .object({
    tipo: z.enum(["pagar", "receber"]),
    valor: z.number().positive(),
    favorecido: z.string().min(1).max(200),
    descricao: z.string().min(1).max(500),
    vencimento: data,
    obraId: z.string().uuid(),
    categoria: z.string().max(100).optional(),
    formaPagamento: z.string().max(100).optional(),
    pagoEm: data.optional(),
  })
  .strict();

const lancarConta = ferramenta({
  nome: "lancar_conta",
  descricao:
    "PROPÕE lançar uma conta nova: a pagar (despesa, gasto, boleto) ou a receber (entrada, serviço prestado, venda). Não grava: o sistema mostra o resumo e o usuário confirma com SIM. " +
    "Antes de usar para algo que o usuário diz que já pagou, procure a conta existente com listar_contas (busca) e prefira dar_baixa. " +
    "Precisa de valor e favorecido/cliente; para conta em aberto, também do vencimento (pergunte se faltar). Projeto: o nome que o usuário disser; se o sistema pedir, pergunte.",
  entrada: z
    .object({
      tipo: z.enum(["pagar", "receber"]),
      valor: z.number().positive().max(100_000_000).describe("Em reais, ex.: 150 ou 1234.56"),
      favorecido: z.string().trim().min(1).max(200).describe("Quem recebe (a pagar) ou quem paga (a receber), ex.: Vivo, Cliente Silva"),
      descricao: z.string().trim().min(1).max(300).describe("Do que se trata, curto, ex.: Internet do escritório"),
      vencimento: data.optional().describe("aaaa-mm-dd. Obrigatório se ainda não foi pago/recebido."),
      ja_pago: z.boolean().default(false).describe("true se o usuário disse que já pagou/recebeu"),
      pago_em: data.optional().describe("aaaa-mm-dd do pagamento/recebimento; padrão hoje"),
      projeto: z.string().trim().min(1).max(120).optional().describe("Nome do projeto/obra dito pelo usuário"),
      categoria: z.enum(CATEGORIAS).optional().describe(`A pagar: ${categoriasPagar.join(", ")}. A receber: ${categoriasReceber.join(", ")}.`),
      forma_pagamento: z.enum(FORMAS).optional(),
    })
    .strict(),
  modulos: ESCREVER_CONTAS,
  async executar(ctx, a) {
    exigirEscrita(ctx, a.tipo);
    if (a.categoria && !(a.tipo === "pagar" ? (categoriasPagar as string[]) : (categoriasReceber as string[])).includes(a.categoria)) {
      throw new PedidoIncompleto(`Categoria ${a.categoria} não vale para conta a ${a.tipo}. Use: ${(a.tipo === "pagar" ? categoriasPagar : categoriasReceber).join(", ")}.`);
    }
    if (!a.ja_pago && !a.vencimento) throw new PedidoIncompleto("Falta a data de vencimento. Pergunte ao usuário.");
    const pagoEm = a.ja_pago ? (a.pago_em ?? ctx.hoje) : undefined;
    if (pagoEm && pagoEm > ctx.hoje) throw new PedidoIncompleto("A data do pagamento não pode ser no futuro. Confirme com o usuário.");
    const vencimento = a.vencimento ?? pagoEm ?? ctx.hoje;
    const projeto = await resolverProjeto(ctx, a.projeto, a.tipo);

    // Duplicidade: mesmo tipo, valor e vencimento ainda valendo, e nome parecido (favorecido ou descrição). Não bloqueia
    // (pode ser legítimo), mas avisa no resumo.
    const mesmasDatas = await prisma.contaFinanceira.findMany({
      where: { empresaId: ctx.contas.empresaId, tipo: a.tipo, valor: Math.round(a.valor * 100) / 100, dataVencimento: vencimento, status: { not: "cancelada" } },
      select: { favorecidoOuCliente: true, descricao: true },
      take: 20,
    });
    const palavras = (t: string) => new Set(semAcento(t).split(/[^a-z0-9]+/).filter((p) => p.length >= 4 && !PALAVRAS_COMUNS.has(p)));
    const doPedido = palavras(`${a.favorecido} ${a.descricao}`);
    const parecida = mesmasDatas.find((c) => [...palavras(`${c.favorecidoOuCliente} ${c.descricao}`)].some((p) => doPedido.has(p)));

    const linhas = [
      `Vou lançar uma conta a ${a.tipo === "pagar" ? "pagar" : "receber"}:`,
      `• ${a.tipo === "pagar" ? "Favorecido" : "Cliente"}: ${a.favorecido}`,
      `• Descrição: ${a.descricao}`,
      `• Valor: ${real(a.valor)}`,
      `• Vencimento: ${dataBr(vencimento)}`,
      `• Projeto: ${projeto.nome}`,
      ...(a.categoria ? [`• Categoria: ${rotuloCategoria(a.categoria)}`] : []),
      ...(a.forma_pagamento ? [`• Forma: ${(rotulosFormaPagamento as Record<string, string>)[a.forma_pagamento]}`] : []),
      `• Situação: ${pagoEm ? `já ${a.tipo === "pagar" ? "paga" : "recebida"} em ${dataBr(pagoEm)}` : "em aberto"}`,
      ...(parecida ? ["", `Atenção: já existe uma conta com o mesmo valor e vencimento (${parecida.favorecidoOuCliente} · ${parecida.descricao}). Confira se não é a mesma.`] : []),
      "",
      CONFIRMA,
    ];
    const dados: z.infer<typeof dadosLancamento> = {
      tipo: a.tipo,
      valor: Math.round(a.valor * 100) / 100,
      favorecido: a.favorecido,
      descricao: a.descricao,
      vencimento,
      obraId: projeto.id,
      categoria: a.categoria,
      formaPagamento: a.forma_pagamento,
      pagoEm,
    };
    return { proposta: { resumo: linhas.join("\n"), dados } };
  },
  async efetivar(ctx, bruto) {
    const d = dadosLancamento.parse(bruto);
    const conta = await contas.criarConta(ctx.contas, {
      tipo: d.tipo,
      obraId: d.obraId,
      valor: d.valor,
      dataLancamento: ctx.hoje,
      dataVencimento: d.vencimento,
      favorecidoOuCliente: d.favorecido,
      descricao: d.descricao,
      categoria: d.categoria,
      formaPagamento: d.formaPagamento,
      observacao: "Lançada pelo assistente do WhatsApp.",
      comprovanteUrl: "",
      origemNotaFiscal: false,
      precisaCompletarCadastro: false,
    });
    const final = d.pagoEm && conta.status === "em_aberto" ? await contas.baixarConta(ctx.contas, { contaId: conta.id, dataBaixa: d.pagoEm }) : conta;
    const situacao = final.status === "baixada" ? (final.tipo === "pagar" ? "já paga" : "já recebida") : `vence ${dataBr(final.dataVencimento)}`;
    return {
      texto: `Pronto! Conta a ${final.tipo} lançada: ${final.favorecidoOuCliente} · ${real(final.valor)} · ${situacao}.\nVer no app: ${link(final)}`,
      registroId: final.id,
    };
  },
});

// ---------------------------------------------------------------------------------------------------------------------

const ref = z.string().trim().regex(/^[0-9a-f]{8}$/i, "ref de 8 caracteres de uma conta citada");
const dadosBaixa = z.object({ contaId: z.string().uuid(), dataBaixa: data }).strict();

const darBaixa = ferramenta({
  nome: "dar_baixa",
  descricao:
    "PROPÕE marcar uma conta EM ABERTO como paga (a pagar) ou recebida (a receber), pela ref devolvida por listar_contas/detalhar_conta. Não grava: o usuário confirma com SIM. " +
    "Use quando o usuário diz que pagou/recebeu uma conta que existe. Se houver mais de uma conta parecida, pergunte qual antes.",
  entrada: z.object({ ref, data: data.optional().describe("aaaa-mm-dd do pagamento/recebimento; padrão hoje") }).strict(),
  modulos: ESCREVER_CONTAS,
  async executar(ctx, a) {
    const conta = await contaAbertaPelaRef(ctx, a.ref);
    const dataBaixa = a.data ?? ctx.hoje;
    if (dataBaixa > ctx.hoje) throw new PedidoIncompleto("A data do pagamento não pode ser no futuro. Confirme com o usuário.");
    const verbo = conta.tipo === "pagar" ? "paga" : "recebida";
    const resumo = [`Vou marcar como ${verbo} em ${dataBr(dataBaixa)}:`, `• ${linhaConta(conta)}`, "", CONFIRMA].join("\n");
    return { proposta: { resumo, dados: { contaId: conta.id, dataBaixa } }, citadas: [citar(conta)] };
  },
  async efetivar(ctx, bruto) {
    const d = dadosBaixa.parse(bruto);
    // Confere de novo: entre a proposta e o SIM alguém pode ter baixado ou cancelado pelo app.
    const atual = await contas.obterContaPorId(ctx.contas, d.contaId);
    if (!atual) throw new Error("Conta não encontrada.");
    if (atual.status !== "em_aberto") throw new Error("Essa conta não está mais em aberto (alguém já mexeu nela pelo app).");
    const conta = await contas.baixarConta(ctx.contas, { contaId: d.contaId, dataBaixa: d.dataBaixa });
    return { texto: `Pronto! ${conta.favorecidoOuCliente} · ${real(conta.valor)} marcada como ${conta.tipo === "pagar" ? "paga" : "recebida"} em ${dataBr(d.dataBaixa)}.\nVer no app: ${link(conta)}`, registroId: conta.id };
  },
});

// ---------------------------------------------------------------------------------------------------------------------

const dadosAlteracao = z
  .object({
    contaId: z.string().uuid(),
    campos: z
      .object({ dataVencimento: data.optional(), valor: z.number().positive().optional(), descricao: z.string().min(1).max(500).optional(), favorecidoOuCliente: z.string().min(1).max(200).optional() })
      .strict(),
  })
  .strict();

const alterarConta = ferramenta({
  nome: "alterar_conta",
  descricao: "PROPÕE alterar uma conta EM ABERTO (vencimento, valor, descrição ou favorecido/cliente), pela ref. Não grava: o usuário confirma com SIM.",
  entrada: z
    .object({
      ref,
      vencimento: data.optional(),
      valor: z.number().positive().max(100_000_000).optional(),
      descricao: z.string().trim().min(1).max(300).optional(),
      favorecido: z.string().trim().min(1).max(200).optional(),
    })
    .strict(),
  modulos: ESCREVER_CONTAS,
  async executar(ctx, a) {
    const conta = await contaAbertaPelaRef(ctx, a.ref);
    const campos: z.infer<typeof dadosAlteracao>["campos"] = {};
    const mudancas: string[] = [];
    if (a.vencimento && a.vencimento !== conta.dataVencimento) {
      campos.dataVencimento = a.vencimento;
      mudancas.push(`• Vencimento: ${dataBr(conta.dataVencimento)} → ${dataBr(a.vencimento)}`);
    }
    if (a.valor !== undefined && Math.round(a.valor * 100) !== Math.round(conta.valor * 100)) {
      if (conta.rateios && conta.rateios.length > 0) throw new PedidoIncompleto("Esta nota está dividida entre projetos: o valor só pode ser mudado no app. Diga isso ao usuário.");
      campos.valor = Math.round(a.valor * 100) / 100;
      mudancas.push(`• Valor: ${real(conta.valor)} → ${real(campos.valor)}`);
    }
    if (a.descricao && a.descricao !== conta.descricao) {
      campos.descricao = a.descricao;
      mudancas.push(`• Descrição: ${conta.descricao} → ${a.descricao}`);
    }
    if (a.favorecido && a.favorecido !== conta.favorecidoOuCliente) {
      campos.favorecidoOuCliente = a.favorecido;
      mudancas.push(`• ${conta.tipo === "pagar" ? "Favorecido" : "Cliente"}: ${conta.favorecidoOuCliente} → ${a.favorecido}`);
    }
    if (mudancas.length === 0) throw new PedidoIncompleto("Nada a mudar: os dados pedidos já são os da conta. Pergunte o que o usuário quer alterar.");
    const resumo = [`Vou alterar a conta ${conta.favorecidoOuCliente} (${conta.descricao}):`, ...mudancas, "", CONFIRMA].join("\n");
    return { proposta: { resumo, dados: { contaId: conta.id, campos } }, citadas: [citar(conta)] };
  },
  async efetivar(ctx, bruto) {
    const d = dadosAlteracao.parse(bruto);
    const conta = await contas.atualizarConta(ctx.contas, d.contaId, d.campos);
    return { texto: `Pronto! Conta alterada: ${linhaConta(conta)}.\nVer no app: ${link(conta)}`, registroId: conta.id };
  },
});

// ---------------------------------------------------------------------------------------------------------------------

const dadosCancelamento = z.object({ contaId: z.string().uuid(), motivo: z.string().max(500).optional() }).strict();

const cancelarConta = ferramenta({
  nome: "cancelar_conta",
  descricao: "PROPÕE cancelar uma conta EM ABERTO lançada por engano ou que não vale mais, pela ref. Não apaga: a conta fica como cancelada, com o motivo. O usuário confirma com SIM.",
  entrada: z.object({ ref, motivo: z.string().trim().min(1).max(300).optional() }).strict(),
  modulos: ESCREVER_CONTAS,
  async executar(ctx, a) {
    const conta = await contaAbertaPelaRef(ctx, a.ref);
    const resumo = [`Vou cancelar esta conta:`, `• ${linhaConta(conta)}`, ...(a.motivo ? [`• Motivo: ${a.motivo}`] : []), "", CONFIRMA].join("\n");
    return { proposta: { resumo, dados: { contaId: conta.id, motivo: a.motivo } }, citadas: [citar(conta)] };
  },
  async efetivar(ctx, bruto) {
    const d = dadosCancelamento.parse(bruto);
    const r = await contas.cancelarConta(ctx.contas, { contaId: d.contaId, motivo: d.motivo ?? "Cancelada pelo assistente do WhatsApp" });
    return { texto: [`Pronto! Conta cancelada: ${r.conta.favorecidoOuCliente} · ${real(r.conta.valor)}.`, ...(r.avisoEstoque ? [r.avisoEstoque] : [])].join("\n"), registroId: r.conta.id };
  },
});

export const FERRAMENTAS_DE_ESCRITA: readonly Ferramenta[] = [lancarConta, darBaixa, alterarConta, cancelarConta] as readonly Ferramenta[];
