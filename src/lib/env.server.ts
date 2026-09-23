import "server-only";
import { z } from "zod";

// Valida as variáveis de ambiente que o app de fato consome. O projeto na
// Vercel/Neon carrega várias outras (PGHOST, PGPASSWORD, POSTGRES_*...) que
// não são lidas por nenhum código nosso — não as validamos aqui de propósito,
// para não criar uma dependência em algo que pode mudar sem afetar o app.
const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL não configurada"),
  DATABASE_URL_UNPOOLED: z.string().min(1, "DATABASE_URL_UNPOOLED não configurada"),
  // Opcional de propósito: src/services/ai/provedor.server.ts cai para
  // MockExtracaoProvider quando ausente (dev/preview sem a chave). Exigi-la
  // aqui derrubaria o app inteiro (este módulo é importado por lib/prisma.ts),
  // não só a extração por IA.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
});

const resultado = schema.safeParse(process.env);

if (!resultado.success) {
  const problemas = resultado.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  throw new Error(`Variáveis de ambiente inválidas — ${problemas}`);
}

export const env = resultado.data;
