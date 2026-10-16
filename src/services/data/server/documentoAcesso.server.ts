import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { obterSessaoOpcional } from "@/lib/auth/dal";
import { verificarLimite } from "@/lib/auth/limite";
import { registrarLogAdmin } from "./adminLog.server";
import { decifrarDocumento } from "./documentoCifra.server";

const ABERTURAS_POR_HORA = 60;
const UMA_HORA_MS = 60 * 60 * 1000;
const idSchema = z.string().uuid();

export type ResultadoAcessoDocumento =
  | { ok: true; bytes: Buffer; mime: string }
  | { ok: false; status: 404 | 429 | 500 };

/**
 * Abertura de documento de verificação: só administrador, com teto por hora e
 * registro de cada abertura em LogAdmin (quem abriu, qual arquivo, de qual
 * pedido, com o hash do conteúdo). A mesma resposta 404 serve para "não existe",
 * "já foi apagado" e "você não pode ver", para não confirmar ids a quem não é admin.
 */
export async function lerDocumentoParaAdmin(id: string): Promise<ResultadoAcessoDocumento> {
  const sessao = await obterSessaoOpcional();
  if (!sessao?.admin) return { ok: false, status: 404 };
  if (!idSchema.safeParse(id).success) return { ok: false, status: 404 };

  const limite = await verificarLimite(`admin-documento:${sessao.usuarioId}`, ABERTURAS_POR_HORA, UMA_HORA_MS);
  if (!limite.permitido) return { ok: false, status: 429 };

  const arquivo = await prisma.arquivo.findFirst({
    where: { id, finalidade: "documento", apagadoEm: null, cifrado: true, solicitacaoId: { not: null } },
    select: { id: true, mime: true, dados: true, sha256: true, solicitacaoId: true },
  });
  if (!arquivo || !arquivo.solicitacaoId) return { ok: false, status: 404 };

  let bytes: Buffer;
  try {
    bytes = decifrarDocumento(arquivo.dados, { id: arquivo.id, solicitacaoId: arquivo.solicitacaoId, mime: arquivo.mime });
  } catch {
    // Chave trocada ou conteúdo alterado: não abre, e fica registrado só o fato.
    console.error("[documentos] falha ao decifrar documento", arquivo.id);
    return { ok: false, status: 500 };
  }
  await prisma.$transaction((tx) =>
    registrarLogAdmin(tx, sessao.usuarioId, "documento.visualizar", "Arquivo", arquivo.id, {
      solicitacaoId: arquivo.solicitacaoId,
      sha256: arquivo.sha256,
    }),
  );
  return { ok: true, bytes, mime: arquivo.mime };
}
