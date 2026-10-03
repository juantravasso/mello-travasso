// yarn admin:promover <email>
// yarn admin:promover <email> --remover
//
// Concede (ou retira) o papel de administrador da plataforma. É o único jeito
// de criar um admin: não existe tela nem endpoint para isso. Registra em
// LogAdmin quem foi alterado e por qual operador do sistema operacional.
import { PrismaClient } from "@prisma/client";

async function main() {
  const [emailBruto, flag] = process.argv.slice(2);
  const email = (emailBruto ?? "").trim().toLowerCase();
  const remover = flag === "--remover";
  if (!email.includes("@")) {
    console.error("Uso: yarn admin:promover <email> [--remover]");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario) {
      console.error("Nenhum usuário encontrado com esse e-mail.");
      process.exit(1);
    }
    const novoPapel = remover ? null : "admin";
    if ((usuario.papelPlataforma ?? null) === novoPapel) {
      console.log(remover ? "Esse usuário já não é admin." : "Esse usuário já é admin.");
      return;
    }

    const operador = process.env.USERNAME || process.env.USER || "desconhecido";
    await prisma.$transaction([
      prisma.usuario.update({
        where: { id: usuario.id },
        data: { papelPlataforma: novoPapel, atualizadoEm: new Date().toISOString() },
      }),
      prisma.logAdmin.create({
        data: {
          adminUsuarioId: usuario.id,
          acao: remover ? "admin.remover" : "admin.promover",
          alvoTipo: "Usuario",
          alvoId: usuario.id,
          detalhes: { operador },
          criadoEm: new Date().toISOString(),
        },
      }),
    ]);
    console.log(remover ? `Papel de admin removido de ${usuario.nome}.` : `${usuario.nome} agora é admin da plataforma.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
