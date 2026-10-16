import "server-only";
import type { Prisma } from "@prisma/client";

/**
 * Apaga os bytes dos documentos de verificação que casam com o filtro (a linha fica, vazia, com a
 * data em que foi apagada). Só mexe em documento cifrado ainda guardado: nunca em imagem de perfil.
 */
export async function apagarBytesDeDocumentos(tx: Prisma.TransactionClient, filtro: Prisma.ArquivoWhereInput): Promise<number> {
  const r = await tx.arquivo.updateMany({
    where: { AND: [filtro, { finalidade: "documento", apagadoEm: null }] },
    data: { dados: new Uint8Array(0), apagadoEm: new Date().toISOString() },
  });
  return r.count;
}
