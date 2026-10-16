import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Prisma lança P2025 quando o `delete`/`update` não acha a linha — isso é
 * esperado aqui (sessão já removida por outra aba/expiração) e é engolido
 * de propósito. Qualquer outro código de erro é do Postgres de verdade e não
 * deve desaparecer em silêncio, ou uma falha real vira "sessão zumbi" sem
 * ninguém notar.
 */
function ignorarSeNaoEncontrado(erro: unknown): void {
  if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2025") return;
  console.error("[auth/sessao] falha ao apagar sessão:", erro);
}

// Token opaco de sessão. O cookie guarda o token em claro (só o navegador do
// usuário o vê); o banco guarda só o sha256 dele em hex — quem lê o banco
// (dump, backup) nunca consegue autenticar com o que está ali.

const NOME_COOKIE = "mt_sessao";
const DURACAO_SESSAO_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias
const RENOVAR_QUANDO_FALTAM_MS = 15 * 24 * 60 * 60 * 1000; // 15 dias

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isoAgora(): string {
  return new Date().toISOString();
}

export async function criarSessao(usuarioId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const agora = new Date();
  const expiraEm = new Date(agora.getTime() + DURACAO_SESSAO_MS);

  await prisma.sessao.create({
    data: {
      id: hashToken(token),
      usuarioId,
      expiraEm: expiraEm.toISOString(),
      criadoEm: agora.toISOString(),
      ultimoUsoEm: agora.toISOString(),
    },
  });

  const store = await cookies();
  store.set(NOME_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACAO_SESSAO_MS / 1000,
  });
}

export interface SessaoValida {
  usuarioId: string;
  nome: string;
  email: string;
  empresaId: string;
  papel: "dono" | "membro";
  /** Administrador da plataforma (independente do papel na empresa). */
  admin: boolean;
  /** O titular já abriu o link enviado a este e-mail. */
  emailConfirmado: boolean;
}

/**
 * Lê o cookie, confere a sessão no banco e renova a expiração quando
 * faltam menos de 15 dias. Retorna null se não houver cookie, a sessão não
 * existir ou tiver expirado — quem chama decide o que fazer (redirecionar,
 * lançar erro).
 */
export async function lerSessao(): Promise<SessaoValida | null> {
  const store = await cookies();
  const token = store.get(NOME_COOKIE)?.value;
  if (!token) return null;

  const sessao = await prisma.sessao.findUnique({
    where: { id: hashToken(token) },
    include: { usuario: { include: { empresa: { select: { bloqueadaEm: true } } } } },
  });

  if (!sessao) return null;
  if (new Date(sessao.expiraEm).getTime() <= Date.now()) {
    await prisma.sessao.delete({ where: { id: sessao.id } }).catch(ignorarSeNaoEncontrado);
    return null;
  }

  // Bloqueio pela administração (usuário ou empresa): vale em toda página, ação e rota, porque
  // todas leem a sessão por aqui. Falha fechada: a sessão é apagada e o visitante vira anônimo.
  if (sessao.usuario.bloqueadoPlataformaEm || sessao.usuario.empresa.bloqueadaEm) {
    await prisma.sessao.delete({ where: { id: sessao.id } }).catch(ignorarSeNaoEncontrado);
    return null;
  }

  const faltam = new Date(sessao.expiraEm).getTime() - Date.now();
  const agora = isoAgora();
  let renovou = false;
  if (faltam < RENOVAR_QUANDO_FALTAM_MS) {
    // Server Components não podem gravar cookie (lança). Só estende a sessão
    // no banco se o cookie também foi renovado; senão o cookie venceria na data
    // antiga mesmo com a sessão estendida. A renovação acontece na próxima
    // chamada de Server Action, rota de API ou login, onde cookies().set vale.
    try {
      store.set(NOME_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: DURACAO_SESSAO_MS / 1000,
      });
      renovou = true;
    } catch {
      renovou = false;
    }
  }
  if (renovou) {
    const novaExpiracao = new Date(Date.now() + DURACAO_SESSAO_MS).toISOString();
    await prisma.sessao.update({
      where: { id: sessao.id },
      data: { expiraEm: novaExpiracao, ultimoUsoEm: agora },
    });
  } else {
    await prisma.sessao.update({ where: { id: sessao.id }, data: { ultimoUsoEm: agora } });
  }

  return {
    usuarioId: sessao.usuario.id,
    nome: sessao.usuario.nome,
    email: sessao.usuario.email,
    empresaId: sessao.usuario.empresaId,
    papel: sessao.usuario.papel,
    admin: sessao.usuario.papelPlataforma === "admin",
    emailConfirmado: sessao.usuario.emailConfirmadoEm !== null,
  };
}

/** Apaga a sessão atual (no banco e o cookie). Usado no logout. */
export async function apagarSessaoAtual(): Promise<void> {
  const store = await cookies();
  const token = store.get(NOME_COOKIE)?.value;
  if (token) {
    await prisma.sessao.delete({ where: { id: hashToken(token) } }).catch(ignorarSeNaoEncontrado);
  }
  store.delete(NOME_COOKIE);
}

/**
 * Apaga sessões vencidas de qualquer usuário. `lerSessao` já apaga a sessão
 * lida quando ela expirou, mas isso só cobre quem tenta usá-la de novo —
 * sessões abandonadas (outro dispositivo, aba nunca reaberta) ficariam para
 * sempre sem isto. Chamada com baixa probabilidade em `entrar()`.
 */
export async function limparSessoesExpiradas(): Promise<void> {
  await prisma.sessao.deleteMany({ where: { expiraEm: { lt: isoAgora() } } });
}

/** Apaga todas as sessões do usuário, exceto a atual — usado na troca de senha. */
export async function apagarOutrasSessoes(usuarioId: string): Promise<void> {
  const store = await cookies();
  const token = store.get(NOME_COOKIE)?.value;
  const idSessaoAtual = token ? hashToken(token) : undefined;

  await prisma.sessao.deleteMany({
    where: { usuarioId, ...(idSessaoAtual ? { id: { not: idSessaoAtual } } : {}) },
  });
}
