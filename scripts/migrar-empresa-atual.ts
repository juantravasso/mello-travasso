// yarn migrar:empresa-atual --documento <CNPJ ou CPF> --email <email> [--razaoSocial "Nome"]
//
// Cria a empresa "cortesia" (RF-17: isenta de teste, sempre ativa — o campo
// de plano é da Fase 4, aqui só criamos Empresa/Usuario) e o primeiro
// usuário "dono", com senha temporária impressa uma única vez no terminal.
// Idempotente: se a Empresa com esse documento já existir, não cria de novo.
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { gerarHash } from "../src/lib/auth/senha";

function lerArgs(): { documento: string; email: string; razaoSocial: string } {
  const args = process.argv.slice(2);
  const mapa = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    const chave = args[i]?.replace(/^--/, "");
    const valor = args[i + 1];
    if (chave && valor) mapa.set(chave, valor);
  }

  const documento = (mapa.get("documento") ?? "").replace(/\D/g, "");
  const email = (mapa.get("email") ?? "").trim().toLowerCase();
  const razaoSocial = mapa.get("razaoSocial") ?? "Mello e Travasso";

  if (!documento || (documento.length !== 11 && documento.length !== 14)) {
    console.error("Uso: yarn migrar:empresa-atual --documento <CNPJ ou CPF, só dígitos> --email <email> [--razaoSocial \"Nome\"]");
    process.exit(1);
  }
  if (!email || !email.includes("@")) {
    console.error("Informe um --email válido.");
    process.exit(1);
  }

  return { documento, email, razaoSocial };
}

function gerarSenhaTemporaria(): string {
  // 16 caracteres, alfanumérico — evita símbolos que compliquem digitar/colar.
  return randomBytes(24)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 16);
}

async function main() {
  const { documento, email, razaoSocial } = lerArgs();
  const prisma = new PrismaClient();

  try {
    const existente = await prisma.empresa.findUnique({ where: { documento } });
    if (existente) {
      console.log(`Empresa com documento ${documento} já existe (id: ${existente.id}). Nada foi criado.`);
      return;
    }

    const senhaTemporaria = gerarSenhaTemporaria();
    const senhaHash = await gerarHash(senhaTemporaria);
    const agora = new Date().toISOString();

    const resultado = await prisma.$transaction(async (tx) => {
      const empresa = await tx.empresa.create({
        data: {
          documento,
          razaoSocial,
          tipoPessoa: documento.length === 14 ? "pj" : "pf",
          plano: "cortesia",
          testeTerminaEm: null,
          // Onboarding manual, não é o fluxo de aceite do checkbox em
          // /criar-conta — versão marcada como tal para não parecer consentimento real.
          aceiteTermosVersao: "manual-onboarding",
          aceiteTermosEm: agora,
          criadoEm: agora,
          atualizadoEm: agora,
        },
      });
      const usuario = await tx.usuario.create({
        data: {
          empresaId: empresa.id,
          nome: razaoSocial,
          email,
          senhaHash,
          papel: "dono",
          trocarSenha: true,
          criadoEm: agora,
          atualizadoEm: agora,
        },
      });
      return { empresa, usuario };
    });

    console.log("");
    console.log("Empresa e usuário criados:");
    console.log(`  Empresa: ${resultado.empresa.razaoSocial} (${resultado.empresa.documento})`);
    console.log(`  Usuário: ${resultado.usuario.email}`);
    console.log("");
    console.log("SENHA TEMPORÁRIA (guarde agora — não será exibida de novo):");
    console.log(`  ${senhaTemporaria}`);
    console.log("");
    console.log("A troca de senha é obrigatória no primeiro login.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
