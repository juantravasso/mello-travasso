// Trava de segurança da demonstração: os dados fictícios só podem ir para um banco DIFERENTE do real. A demo usa uma
// branch separada do Neon, informada em DATABASE_URL_DEMO (e DATABASE_URL_UNPOOLED_DEMO para migrações) no .env.local.
// Se a URL da demo apontar para o mesmo servidor do banco real, nada roda.
import { existsSync } from "node:fs";

/** Identificador do servidor Neon na URL (ep-xxxx), sem o sufixo "-pooler", para comparar a conexão direta e a do pool. */
export function endpoint(url) {
  try {
    return new URL(url).hostname.replace("-pooler", "").split(".")[0];
  } catch {
    return null;
  }
}

export function lerConfigDemo({ exigirDireta = false } = {}) {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const demo = process.env.DATABASE_URL_DEMO;
  const demoDireta = process.env.DATABASE_URL_UNPOOLED_DEMO || demo;
  if (!demo) throw new Error("DATABASE_URL_DEMO não definida no .env.local. Crie uma branch 'demo' no Neon e copie a URL de conexão dela.");
  if (exigirDireta && !process.env.DATABASE_URL_UNPOOLED_DEMO) throw new Error("DATABASE_URL_UNPOOLED_DEMO não definida (conexão direta da branch demo, usada nas migrações).");

  const real = new Set([process.env.DATABASE_URL, process.env.DATABASE_URL_UNPOOLED].filter(Boolean).map(endpoint));
  for (const alvo of [demo, demoDireta]) {
    const e = endpoint(alvo);
    if (!e) throw new Error("URL da demo inválida.");
    if (real.has(e)) throw new Error("RECUSADO: a URL da demo aponta para o mesmo servidor do banco real. Use uma branch separada do Neon.");
  }
  return { demo, demoDireta };
}
