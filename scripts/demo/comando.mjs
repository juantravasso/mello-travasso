// yarn demo:dev      → sobe o site local (porta 3100) apontando para a branch de demonstração, sem e-mails e sem pagamento real.
// yarn demo:migrar   → aplica as migrações na branch de demonstração.
//
// O site real e o banco real não são tocados: tudo passa pela trava de guarda.mjs.
import { spawn } from "node:child_process";
import { lerConfigDemo } from "./guarda.mjs";

const comando = process.argv[2];

function rodar(args, env) {
  const filho = spawn("yarn", args, { stdio: "inherit", shell: true, env: { ...process.env, ...env } });
  filho.on("exit", (codigo) => process.exit(codigo ?? 0));
}

try {
  if (comando === "migrar") {
    const { demo, demoDireta } = lerConfigDemo({ exigirDireta: true });
    rodar(["prisma", "migrate", "deploy"], { DATABASE_URL: demo, DATABASE_URL_UNPOOLED: demoDireta });
  } else if (comando === "dev") {
    const { demo, demoDireta } = lerConfigDemo();
    // Sem e-mail e sem provedor de pagamento: nada sai para fora durante a gravação.
    const zerar = Object.fromEntries(Object.keys(process.env).filter((k) => /^(RESEND_|MERCADOPAGO_|MP_)/.test(k)).map((k) => [k, ""]));
    console.log("Demonstração: usando a branch separada do Neon, e-mails e pagamentos desligados. http://localhost:3100");
    rodar(["dev", "-p", "3100"], { ...zerar, DATABASE_URL: demo, DATABASE_URL_UNPOOLED: demoDireta });
  } else {
    console.error("Use: yarn demo:dev | yarn demo:migrar | yarn demo:semear");
    process.exit(1);
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
