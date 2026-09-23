// yarn empresa:estender-teste <documento> <dias> [operador]
//
// Estende testeTerminaEm em N dias (soma sobre a data atual, preservando o
// horário 23:59 -03:00 já gravado) e registra em EventoConta quem estendeu
// e quando (RF-18). Só funciona para empresas em plano "teste" — para
// "cortesia"/"ativo" não há data de teste para estender.
import { PrismaClient } from "@prisma/client";

function lerArgs(): { documento: string; dias: number; operador: string } {
  const [documentoBruto, diasBruto, operadorArg] = process.argv.slice(2);
  const documento = (documentoBruto ?? "").replace(/\D/g, "");
  const dias = Number(diasBruto);
  const operador = operadorArg || process.env.USERNAME || process.env.USER || "desconhecido";

  if (!documento || (documento.length !== 11 && documento.length !== 14)) {
    console.error("Uso: yarn empresa:estender-teste <documento (CNPJ/CPF, só dígitos)> <dias> [operador]");
    process.exit(1);
  }
  if (!Number.isInteger(dias) || dias <= 0) {
    console.error("Informe um número de dias inteiro e positivo.");
    process.exit(1);
  }

  return { documento, dias, operador };
}

async function main() {
  const { documento, dias, operador } = lerArgs();
  const prisma = new PrismaClient();

  try {
    const empresa = await prisma.empresa.findUnique({ where: { documento } });
    if (!empresa) {
      console.error(`Nenhuma empresa encontrada com documento ${documento}.`);
      process.exit(1);
    }
    if (empresa.plano !== "teste") {
      console.error(`Empresa está em plano "${empresa.plano}", não "teste" — não há data de teste para estender.`);
      process.exit(1);
    }

    const anteriorMs = empresa.testeTerminaEm ? new Date(empresa.testeTerminaEm).getTime() : Date.now();
    const novoTesteTerminaEm = new Date(anteriorMs + dias * 24 * 60 * 60 * 1000).toISOString();
    const agora = new Date().toISOString();

    await prisma.$transaction([
      prisma.empresa.update({
        where: { id: empresa.id },
        data: { testeTerminaEm: novoTesteTerminaEm, atualizadoEm: agora },
      }),
      prisma.eventoConta.create({
        data: {
          empresaId: empresa.id,
          tipo: "teste_estendido",
          detalhes: {
            dias,
            operador,
            testeTerminaEmAnterior: empresa.testeTerminaEm,
            testeTerminaEmNovo: novoTesteTerminaEm,
          },
          criadoEm: agora,
        },
      }),
    ]);

    console.log(`Teste de ${empresa.razaoSocial} estendido em ${dias} dia(s).`);
    console.log(`Novo fim do teste: ${novoTesteTerminaEm}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
