import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "node:crypto";

// Hash de senha com scrypt (nativo do Node, sem dependência externa).
// Formato gravado: "scrypt$N$r$p$salt$hash" (salt e hash em hex) — os
// parâmetros de custo ficam junto do hash para permitir subir N no futuro
// sem invalidar hashes antigos.
//
// Sem "import 'server-only'" de propósito: esse pacote lança erro fora do
// bundler do Next, o que impediria os scripts .ts (scripts/*.ts, rodados
// com tsx) de reusar este módulo. A garantia de não vazar para o client vem
// de quem importa: só src/services/data/server/authActions.ts ("use server"
// — o corpo nunca sai no bundle do client) e scripts de servidor confiáveis.

function scrypt(senha: string, salt: Buffer, tamanho: number, opcoes: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(senha, salt, tamanho, opcoes, (erro, chave) => {
      if (erro) reject(erro);
      else resolve(chave);
    });
  });
}

const N = 2 ** 15;
const r = 8;
const p = 1;
const TAMANHO_HASH = 64;
const TAMANHO_SALT = 16;

async function derivar(senha: string, salt: Buffer): Promise<Buffer> {
  return scrypt(senha.normalize("NFKC"), salt, TAMANHO_HASH, { N, r, p, maxmem: 64 * 1024 * 1024 });
}

export async function gerarHash(senha: string): Promise<string> {
  const salt = randomBytes(TAMANHO_SALT);
  const hash = await derivar(senha, salt);
  return `scrypt$${N}$${r}$${p}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verificarSenha(senha: string, hashArmazenado: string): Promise<boolean> {
  const partes = hashArmazenado.split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;

  const [, nStr, rStr, pStr, saltHex, hashHex] = partes;
  const nArmazenado = Number(nStr);
  const rArmazenado = Number(rStr);
  const pArmazenado = Number(pStr);
  if (!Number.isFinite(nArmazenado) || !Number.isFinite(rArmazenado) || !Number.isFinite(pArmazenado)) return false;

  const salt = Buffer.from(saltHex, "hex");
  const hashEsperado = Buffer.from(hashHex, "hex");
  const chave = await scrypt(senha.normalize("NFKC"), salt, hashEsperado.length, {
    N: nArmazenado,
    r: rArmazenado,
    p: pArmazenado,
    maxmem: 64 * 1024 * 1024,
  });

  if (chave.length !== hashEsperado.length) return false;
  return timingSafeEqual(chave, hashEsperado);
}

/**
 * Gasta um tempo equivalente ao de uma verificação real, sem comparar nada —
 * usada quando o e-mail não existe, para o tempo de resposta do login não
 * revelar se a conta existe.
 */
export async function verificarSenhaFicticia(senha: string): Promise<void> {
  const saltFicticio = Buffer.alloc(TAMANHO_SALT, 0);
  await derivar(senha, saltFicticio);
}
