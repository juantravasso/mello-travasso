// yarn testar:isolamento
//
// Teste automatizado mínimo de isolamento por empresa (Fase 2, ver
// docs/prd/multiempresa-login-trial.md §11 "Pronto quando"). Como o projeto
// não tem runner de teste, isto é um script tsx: cria 2 empresas fixture
// descartáveis, um recurso de cada tipo para a Empresa A, e confere que a
// Empresa B não consegue ler, atualizar nem apagar nada da A — nas 7 tabelas
// que têm empresaId. Sempre limpa o que criou, mesmo se um teste falhar.
//
// Não passa pelas Server Actions (elas leem a sessão do cookie via
// next/headers, que só existe dentro de uma requisição HTTP real). Em vez
// disso, exercita exatamente a mesma forma de query que as actions usam —
// where/updateMany/deleteMany com { id, empresaId } — que é a defesa real
// contra IDOR entre empresas.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

let falhas = 0;

function checar(descricao: string, condicaoOk: boolean): void {
  if (condicaoOk) {
    console.log(`  OK   ${descricao}`);
  } else {
    falhas++;
    console.log(`  FALHOU  ${descricao}`);
  }
}

function documentoFixture(sufixo: string): string {
  // 14 dígitos únicos por execução — não precisa ser um CNPJ válido, é só
  // fixture descartável, nunca usado por login/cadastro real.
  return `9${Date.now().toString().slice(-8)}${sufixo}`.padEnd(14, "0").slice(0, 14);
}

async function main() {
  const agora = new Date().toISOString();

  const dadosCadastroFixture = {
    tipoPessoa: "pj" as const,
    plano: "cortesia" as const,
    aceiteTermosVersao: "fixture",
    aceiteTermosEm: agora,
  };
  const empresaA = await prisma.empresa.create({
    data: {
      documento: documentoFixture("01"),
      razaoSocial: "[fixture] Empresa A",
      criadoEm: agora,
      atualizadoEm: agora,
      ...dadosCadastroFixture,
    },
  });
  const empresaB = await prisma.empresa.create({
    data: {
      documento: documentoFixture("02"),
      razaoSocial: "[fixture] Empresa B",
      criadoEm: agora,
      atualizadoEm: agora,
      ...dadosCadastroFixture,
    },
  });

  try {
    const obraA = await prisma.obra.create({
      data: {
        empresaId: empresaA.id,
        nome: "[fixture] Obra A",
        cliente: "Cliente A",
        status: "em_andamento",
        dataInicio: "2026-01-01",
        criadoEm: agora,
        atualizadoEm: agora,
      },
    });

    const fornecedorA = await prisma.fornecedor.create({
      data: { empresaId: empresaA.id, nome: "[fixture] Fornecedor A", criadoEm: agora, atualizadoEm: agora },
    });

    const contaA = await prisma.contaFinanceira.create({
      data: {
        empresaId: empresaA.id,
        tipo: "pagar",
        obraId: obraA.id,
        valor: 100,
        dataLancamento: "2026-01-01",
        dataVencimento: "2026-02-01",
        favorecidoOuCliente: "Fornecedor A",
        fornecedorId: fornecedorA.id,
        descricao: "[fixture] conta A",
        comprovanteUrl: "",
        historico: [],
        criadoEm: agora,
        atualizadoEm: agora,
      },
    });

    const itemA = await prisma.itemProduto.create({
      data: {
        empresaId: empresaA.id,
        contaFinanceiraId: contaA.id,
        obraId: obraA.id,
        descricao: "[fixture] item A",
        quantidade: 1,
        valorUnitario: 10,
        valorTotal: 10,
        dataCompra: "2026-01-01",
        criadoEm: agora,
      },
    });

    const funcionarioA = await prisma.funcionario.create({
      data: {
        empresaId: empresaA.id,
        nome: "[fixture] Funcionário A",
        cargo: "Pedreiro",
        dataAdmissao: "2026-01-01",
        criadoEm: agora,
        atualizadoEm: agora,
      },
    });

    const categoriaA = await prisma.categoriaPersonalizada.create({
      data: { empresaId: empresaA.id, tipoConta: "pagar", rotulo: "[fixture] categoria A", criadoEm: agora },
    });

    const formaPagamentoA = await prisma.formaPagamentoPersonalizada.create({
      data: { empresaId: empresaA.id, rotulo: "[fixture] forma A", criadoEm: agora },
    });

    const recursos = [
      { tabela: "Obra", modelo: prisma.obra, id: obraA.id },
      { tabela: "ContaFinanceira", modelo: prisma.contaFinanceira, id: contaA.id },
      { tabela: "Fornecedor", modelo: prisma.fornecedor, id: fornecedorA.id },
      { tabela: "ItemProduto", modelo: prisma.itemProduto, id: itemA.id },
      { tabela: "Funcionario", modelo: prisma.funcionario, id: funcionarioA.id },
      { tabela: "CategoriaPersonalizada", modelo: prisma.categoriaPersonalizada, id: categoriaA.id },
      { tabela: "FormaPagamentoPersonalizada", modelo: prisma.formaPagamentoPersonalizada, id: formaPagamentoA.id },
    ] as const;

    console.log(`Empresa A: ${empresaA.id} · Empresa B: ${empresaB.id}\n`);

    for (const { tabela, modelo, id } of recursos) {
      console.log(`${tabela}:`);

      // 1) Ler como Empresa B não deve achar nada.
      // @ts-expect-error -- os 7 delegates têm o mesmo shape (id, empresaId), mas o TS não unifica.
      const lido = await modelo.findFirst({ where: { id, empresaId: empresaB.id } });
      checar("leitura cross-empresa retorna null", lido === null);

      // 2) Atualizar como Empresa B não deve afetar nenhuma linha.
      // @ts-expect-error -- idem.
      const atualizado = await modelo.updateMany({ where: { id, empresaId: empresaB.id }, data: { criadoEm: agora } });
      checar("updateMany cross-empresa afeta 0 linhas", atualizado.count === 0);

      // 3) Apagar como Empresa B não deve afetar nenhuma linha.
      // @ts-expect-error -- idem.
      const apagado = await modelo.deleteMany({ where: { id, empresaId: empresaB.id } });
      checar("deleteMany cross-empresa afeta 0 linhas", apagado.count === 0);

      // 4) O recurso continua existindo, intacto, na Empresa A.
      // @ts-expect-error -- idem.
      const aindaExiste = await modelo.count({ where: { id, empresaId: empresaA.id } });
      checar("recurso continua existindo na empresa dona", aindaExiste === 1);
    }

    console.log("");
    if (falhas === 0) {
      console.log(`Isolamento OK — ${recursos.length} tabelas, 0 vazamentos.`);
    } else {
      console.log(`FALHOU — ${falhas} verificação(ões) de isolamento não passaram.`);
    }
  } finally {
    // Limpeza — ordem inversa das FKs. Sempre roda, inclusive se algum
    // "checar" acima tiver falhado.
    await prisma.itemProduto.deleteMany({ where: { empresaId: { in: [empresaA.id, empresaB.id] } } });
    await prisma.contaFinanceira.deleteMany({ where: { empresaId: { in: [empresaA.id, empresaB.id] } } });
    await prisma.funcionario.deleteMany({ where: { empresaId: { in: [empresaA.id, empresaB.id] } } });
    await prisma.fornecedor.deleteMany({ where: { empresaId: { in: [empresaA.id, empresaB.id] } } });
    await prisma.categoriaPersonalizada.deleteMany({ where: { empresaId: { in: [empresaA.id, empresaB.id] } } });
    await prisma.formaPagamentoPersonalizada.deleteMany({ where: { empresaId: { in: [empresaA.id, empresaB.id] } } });
    await prisma.obra.deleteMany({ where: { empresaId: { in: [empresaA.id, empresaB.id] } } });
    await prisma.empresa.deleteMany({ where: { id: { in: [empresaA.id, empresaB.id] } } });
    await prisma.$disconnect();
  }

  if (falhas > 0) process.exit(1);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
