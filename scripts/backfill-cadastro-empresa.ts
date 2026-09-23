// yarn backfill:cadastro-empresa
//
// Preenche os campos novos da Fase 3 (tipoPessoa, plano, aceite de termos)
// para empresas criadas antes desta fase existir — hoje só a que veio de
// migrar-empresa-atual.ts (Fase 1). Empresas "grandfathered" recebem
// plano="cortesia" (nunca "teste": RF-17 diz que a empresa atual é isenta) e
// um aceite de termos sintético, marcado como tal — não é consentimento real,
// só o valor necessário para a coluna virar NOT NULL no próximo passo.
//
// Usa $executeRaw (não o client tipado) de propósito: depois que a migration
// seguinte torna plano/tipoPessoa/aceiteTermos* obrigatórios, o Prisma Client
// para de aceitar `null` nesses campos em runtime E em tipo — este script só
// faz sentido rodar ANTES dessa migration, quando as colunas ainda existem
// como NULL no banco (o schema.prisma do repo já reflete o estado final).
import { PrismaClient } from "@prisma/client";

const VERSAO_TERMOS_GRANDFATHERED = "0-anterior-ao-cadastro-publico";

async function main() {
  const prisma = new PrismaClient();
  try {
    const agora = new Date().toISOString();

    const linhasAfetadas = await prisma.$executeRaw`
      UPDATE "Empresa"
      SET
        "tipoPessoa" = 'pj',
        "plano" = 'cortesia',
        "testeTerminaEm" = NULL,
        "aceiteTermosVersao" = ${VERSAO_TERMOS_GRANDFATHERED},
        "aceiteTermosEm" = ${agora}
      WHERE "plano" IS NULL
    `;

    console.log(`Empresas atualizadas: ${linhasAfetadas}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
