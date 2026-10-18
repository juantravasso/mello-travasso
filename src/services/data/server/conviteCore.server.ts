import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { gerarCodigoConvite, linkDoConvite, normalizarCodigoConvite } from "@/lib/convite";
import type { ResumoConvite } from "@/types";

// Link de convite da empresa. É só rastreio: guarda qual empresa convidou qual, sem dar acesso a nada da outra.
// O código nasce na primeira vez que o dono abre o link (empresas antigas não precisam de backfill).

const TENTATIVAS_DE_CODIGO = 5;

/** O código da empresa; cria um se ainda não existir. Seguro com duas chamadas ao mesmo tempo. */
export async function garantirCodigo(empresaId: string): Promise<string> {
  for (let tentativa = 0; tentativa < TENTATIVAS_DE_CODIGO; tentativa++) {
    const atual = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { codigoConvite: true } });
    if (!atual) throw new Error("EMPRESA_INEXISTENTE");
    if (atual.codigoConvite) return atual.codigoConvite;
    try {
      // Só grava se ainda estiver vazio: se outra chamada chegou antes, count = 0 e o laço relê o código dela.
      await prisma.empresa.updateMany({ where: { id: empresaId, codigoConvite: null }, data: { codigoConvite: gerarCodigoConvite() } });
    } catch (erro) {
      // P2002: o código sorteado já é de outra empresa (raríssimo). Sorteia de novo.
      if (!(erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002")) throw erro;
    }
  }
  // A última tentativa pode ter gravado: confere antes de desistir.
  const final = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { codigoConvite: true } });
  if (final?.codigoConvite) return final.codigoConvite;
  throw new Error("CODIGO_CONVITE_INDISPONIVEL");
}

export async function resumo(empresaId: string, urlBase: string): Promise<ResumoConvite> {
  const codigo = await garantirCodigo(empresaId);
  const total = await prisma.empresa.count({ where: { convidadaPorId: empresaId } });
  return { codigo, link: linkDoConvite(urlBase, codigo), total };
}

/**
 * Empresa dona do código recebido no cadastro. Código fora do formato, desconhecido ou de empresa bloqueada
 * vira null e o cadastro segue normalmente: o convite nunca pode impedir (nem revelar nada sobre) uma conta nova.
 */
export async function resolverEmpresaConvidante(codigoBruto: unknown): Promise<string | null> {
  const codigo = normalizarCodigoConvite(codigoBruto);
  if (!codigo) return null;
  const empresa = await prisma.empresa.findUnique({ where: { codigoConvite: codigo }, select: { id: true, bloqueadaEm: true } });
  if (!empresa || empresa.bloqueadaEm) return null;
  return empresa.id;
}
