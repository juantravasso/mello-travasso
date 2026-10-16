import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

// Rate limit de janela fixa, guardado no Postgres (sem Redis/Upstash — ver
// PRD §6, mini-ADR). A chave é sempre um hash: nunca gravamos e-mail/IP em
// claro na tabela LimiteTaxa.

function hashChave(chave: string): string {
  return createHash("sha256").update(chave).digest("hex");
}

export interface ResultadoLimite {
  permitido: boolean;
  restantes: number;
}

/**
 * Verifica e incrementa o contador de uma chave dentro de uma janela fixa.
 * Ex.: verificarLimite("login:" + email + ":" + ip, 5, 60_000).
 *
 * Feito com um único INSERT ... ON CONFLICT (upsert atômico do Postgres) em
 * vez de "ler o contador, decidir, gravar": duas requisições concorrentes
 * lendo o mesmo contador antes de qualquer uma escrever poderiam as duas
 * passar pelo limite (TOCTOU). O CASE dentro do UPDATE decide, na mesma
 * instrução, se reinicia a janela (expirada) ou incrementa.
 */
export async function verificarLimite(chaveBruta: string, maximo: number, janelaMs: number): Promise<ResultadoLimite> {
  const chave = hashChave(chaveBruta);
  const agoraIso = new Date().toISOString();
  const limiteJanelaIso = new Date(Date.now() - janelaMs).toISOString();

  const linhas = await prisma.$queryRaw<{ contagem: number; janelaInicio: string }[]>`
    INSERT INTO "LimiteTaxa" ("chave", "janelaInicio", "contagem")
    VALUES (${chave}, ${agoraIso}, 1)
    ON CONFLICT ("chave") DO UPDATE SET
      "contagem" = CASE
        WHEN "LimiteTaxa"."janelaInicio" < ${limiteJanelaIso} THEN 1
        ELSE "LimiteTaxa"."contagem" + 1
      END,
      "janelaInicio" = CASE
        WHEN "LimiteTaxa"."janelaInicio" < ${limiteJanelaIso} THEN ${agoraIso}
        ELSE "LimiteTaxa"."janelaInicio"
      END
    RETURNING "contagem", "janelaInicio"
  `;

  const contagem = linhas[0]?.contagem ?? 1;
  if (contagem > maximo) {
    return { permitido: false, restantes: 0 };
  }
  return { permitido: true, restantes: maximo - contagem };
}

/**
 * Devolve uma tentativa já contada (o contador nunca fica abaixo de zero). Para limites que só devem
 * pesar sobre as falhas: a tentativa é contada antes, de forma atômica, e devolvida se deu certo.
 */
export async function devolverTentativa(chaveBruta: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "LimiteTaxa" SET "contagem" = GREATEST("contagem" - 1, 0) WHERE "chave" = ${hashChave(chaveBruta)}
  `;
}

/**
 * Apaga janelas de LimiteTaxa vencidas há mais de 1 dia (toda janela usada
 * hoje é <= 1h, então qualquer coisa mais velha que isso já não é consultada
 * por ninguém). Chamada com baixa probabilidade em `entrar()` — não é um job
 * agendado, é a "limpeza oportunista" prometida no PRD §7 (LGPD/Retenção).
 */
export async function limparLimitesExpirados(): Promise<void> {
  const umDiaAtras = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await prisma.limiteTaxa.deleteMany({ where: { janelaInicio: { lt: umDiaAtras } } });
}

/**
 * Primeiro IP confiável da cadeia x-forwarded-for que a Vercel injeta.
 * Nunca aceite um IP vindo de um campo do formulário/client.
 *
 * Depende da Vercel: a borda sobrescreve o cabeçalho, então o cliente não o forja. Em outro host sem um
 * proxy confiável na frente, o primeiro item é controlável pelo cliente e os tetos por IP deixam de valer.
 */
export function extrairIpConfiavel(headers: Headers): string {
  const encaminhado = headers.get("x-forwarded-for");
  if (encaminhado) {
    const primeiro = encaminhado.split(",")[0]?.trim();
    if (primeiro) return primeiro;
  }
  return "desconhecido";
}
