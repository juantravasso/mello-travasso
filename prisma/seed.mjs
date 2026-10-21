// Seed único, rodado manualmente com `node prisma/seed.mjs` (não a cada boot
// do app — com um banco compartilhado, "semear se vazio" a cada carregamento
// de página criaria corrida entre usuários). Dados de exemplo iguais aos que
// já existiam no protótipo em localStorage, só para dar um ponto de partida.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const AGORA = new Date().toISOString();

async function main() {
  const existentes = await prisma.obra.count();
  if (existentes > 0) {
    console.log("Já existem obras no banco — pulando seed.");
    return;
  }

  const obraAlfa = await prisma.obra.create({
    data: {
      nome: "Edifício Comercial Alfa",
      cliente: "Alfa Empreendimentos Ltda.",
      endereco: "Av. Paulista, 1000 - São Paulo/SP",
      status: "em_andamento",
      dataInicio: "2026-02-01",
      orcamentoPrevisto: 850000,
      criadoEm: AGORA,
      atualizadoEm: AGORA,
    },
  });

  const obraBeta = await prisma.obra.create({
    data: {
      nome: "Galpão Logístico Beta",
      cliente: "Beta Logística S.A.",
      endereco: "Rod. Anhanguera, km 45 - Jundiaí/SP",
      status: "em_andamento",
      dataInicio: "2026-05-15",
      orcamentoPrevisto: 1200000,
      criadoEm: AGORA,
      atualizadoEm: AGORA,
    },
  });

  const contaConcreto = await prisma.contaFinanceira.create({
    data: {
      tipo: "pagar",
      obraId: obraAlfa.id,
      valor: 12500.5,
      dataLancamento: "2026-08-19",
      dataVencimento: "2026-08-20",
      dataBaixa: "2026-08-19",
      status: "baixada",
      favorecidoOuCliente: "Concretex Materiais de Construção",
      descricao: "Concreto usinado - fundação bloco A",
      categoria: "custo_produtos",
      formaPagamento: "pix",
      comprovanteUrl: "",
      origemNotaFiscal: false,
      precisaCompletarCadastro: false,
      historico: [
        { id: crypto.randomUUID(), tipo: "criacao", usuario: "Responsável 1", data: AGORA },
        { id: crypto.randomUUID(), tipo: "baixa", usuario: "Responsável 1", data: AGORA },
      ],
      criadoEm: AGORA,
      atualizadoEm: AGORA,
    },
  });

  await prisma.contaFinanceira.create({
    data: {
      tipo: "pagar",
      obraId: obraAlfa.id,
      valor: 3800,
      dataLancamento: "2026-09-10",
      dataVencimento: "2026-09-25",
      status: "em_aberto",
      favorecidoOuCliente: "Elétrica Silva Instalações",
      descricao: "Mão de obra - instalações elétricas 2º pavimento",
      categoria: "custo_funcionario",
      comprovanteUrl: "",
      origemNotaFiscal: false,
      precisaCompletarCadastro: true,
      historico: [{ id: crypto.randomUUID(), tipo: "criacao", usuario: "Responsável 2", data: AGORA }],
      criadoEm: AGORA,
      atualizadoEm: AGORA,
    },
  });

  await prisma.contaFinanceira.create({
    data: {
      tipo: "receber",
      obraId: obraBeta.id,
      valor: 150000,
      dataLancamento: "2026-09-01",
      dataVencimento: "2026-09-30",
      status: "em_aberto",
      favorecidoOuCliente: "Beta Logística S.A.",
      descricao: "Medição mensal - setembro/2026",
      categoria: "obras",
      comprovanteUrl: "",
      origemNotaFiscal: false,
      precisaCompletarCadastro: false,
      historico: [{ id: crypto.randomUUID(), tipo: "criacao", usuario: "Responsável 1", data: AGORA }],
      criadoEm: AGORA,
      atualizadoEm: AGORA,
    },
  });

  await prisma.itemProduto.createMany({
    data: [
      {
        contaFinanceiraId: contaConcreto.id,
        obraId: obraAlfa.id,
        descricao: "Cimento CP-II 50kg",
        quantidade: 200,
        unidade: "saco",
        valorUnitario: 34.9,
        valorTotal: 6980,
        dataCompra: "2026-08-15",
        fornecedor: "Concretex Materiais de Construção",
        criadoEm: AGORA,
      },
      {
        contaFinanceiraId: contaConcreto.id,
        obraId: obraAlfa.id,
        descricao: "Vergalhão CA-50 10mm",
        quantidade: 500,
        unidade: "un",
        valorUnitario: 28.4,
        valorTotal: 14200,
        dataCompra: "2026-07-10",
        fornecedor: "Aços Andrade",
        criadoEm: AGORA,
      },
      {
        contaFinanceiraId: contaConcreto.id,
        obraId: obraBeta.id,
        descricao: "Cimento CP-II 50kg",
        quantidade: 150,
        unidade: "saco",
        valorUnitario: 36.5,
        valorTotal: 5475,
        dataCompra: "2026-09-01",
        fornecedor: "Materconst Distribuidora",
        criadoEm: AGORA,
      },
    ],
  });

  await prisma.funcionario.createMany({
    data: [
      {
        nome: "João Silva",
        cargo: "Engenheiro Responsável",
        telefone: "(11) 98888-1234",
        email: "joao.silva@exemplo.com.br",
        dataAdmissao: "2024-03-01",
        obraId: obraAlfa.id,
        status: "ativo",
        criadoEm: AGORA,
        atualizadoEm: AGORA,
      },
      {
        nome: "Maria Oliveira",
        cargo: "Mestre de Obras",
        telefone: "(11) 97777-5678",
        dataAdmissao: "2025-01-15",
        obraId: obraBeta.id,
        status: "ativo",
        criadoEm: AGORA,
        atualizadoEm: AGORA,
      },
      {
        nome: "Carlos Pereira",
        cargo: "Pedreiro",
        dataAdmissao: "2023-08-10",
        obraId: obraAlfa.id,
        status: "ativo",
        criadoEm: AGORA,
        atualizadoEm: AGORA,
      },
    ],
  });

  console.log("Seed concluído.");
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
