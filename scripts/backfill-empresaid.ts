// yarn backfill:empresaid --documento <CNPJ ou CPF da empresa de destino>
//
// Preenche empresaId (ainda opcional no schema) nas 7 tabelas de dados, para
// todas as linhas que ainda não têm — parte da migração em 2 passos da Fase 2
// (docs/prd/multiempresa-login-trial.md §11 Fase 2): coluna opcional →
// backfill (este script) → coluna obrigatória (próxima migration).
// Idempotente: só toca linhas com empresaId IS NULL.
import { PrismaClient } from "@prisma/client";

function lerDocumento(): string {
  const args = process.argv.slice(2);
  const indice = args.indexOf("--documento");
  const documento = (indice >= 0 ? args[indice + 1] : "")?.replace(/\D/g, "") ?? "";
  if (!documento || (documento.length !== 11 && documento.length !== 14)) {
    console.error("Uso: yarn backfill:empresaid --documento <CNPJ ou CPF, só dígitos>");
    process.exit(1);
  }
  return documento;
}

async function main() {
  const documento = lerDocumento();
  const prisma = new PrismaClient();

  try {
    const empresa = await prisma.empresa.findUnique({ where: { documento } });
    if (!empresa) {
      console.error(`Nenhuma empresa encontrada com documento ${documento}. Rode antes o migrar-empresa-atual.`);
      process.exit(1);
    }

    const tabelas = [
      { nome: "Obra", modelo: prisma.obra },
      { nome: "ContaFinanceira", modelo: prisma.contaFinanceira },
      { nome: "Fornecedor", modelo: prisma.fornecedor },
      { nome: "ItemProduto", modelo: prisma.itemProduto },
      { nome: "Funcionario", modelo: prisma.funcionario },
      { nome: "CategoriaPersonalizada", modelo: prisma.categoriaPersonalizada },
      { nome: "FormaPagamentoPersonalizada", modelo: prisma.formaPagamentoPersonalizada },
    ] as const;

    console.log(`Empresa de destino: ${empresa.razaoSocial} (${empresa.id})`);
    console.log("");

    for (const { nome, modelo } of tabelas) {
      // @ts-expect-error -- cada modelo tem o mesmo shape (empresaId nullable), mas o TS não unifica os 7 delegates.
      const antes = await modelo.count({ where: { empresaId: null } });
      // @ts-expect-error -- idem.
      const resultado = await modelo.updateMany({ where: { empresaId: null }, data: { empresaId: empresa.id } });
      console.log(`${nome}: ${antes} linha(s) sem empresa → ${resultado.count} atualizada(s)`);
    }

    console.log("");
    console.log("Backfill concluído. Confira as contagens acima antes de rodar a migration que torna empresaId obrigatório.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
