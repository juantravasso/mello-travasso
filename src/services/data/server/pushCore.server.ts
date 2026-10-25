import "server-only";
import { prisma } from "@/lib/prisma";
import { ErroDeNegocio } from "./resultado.server";

const MAXIMO_APARELHOS = 10;

/**
 * Registra o aparelho da pessoa. O mesmo endpoint só existe uma vez: se ele já pertencia a outra conta (navegador
 * compartilhado onde alguém entrou com outro login), passa para quem acabou de ligar, para o push não vazar para a
 * conta anterior.
 */
export async function salvarInscricao(usuarioId: string, i: { endpoint: string; p256dh: string; auth: string }): Promise<void> {
  const agoraIso = new Date().toISOString();
  await prisma.$transaction(async (tx) => {
    const existente = await tx.inscricaoPush.findUnique({ where: { endpoint: i.endpoint }, select: { usuarioId: true } });
    if (!existente) {
      const total = await tx.inscricaoPush.count({ where: { usuarioId } });
      if (total >= MAXIMO_APARELHOS) throw new ErroDeNegocio(`Você já tem ${MAXIMO_APARELHOS} aparelhos com notificações ligadas. Desligue algum antes.`);
    }
    await tx.inscricaoPush.upsert({
      where: { endpoint: i.endpoint },
      create: { usuarioId, endpoint: i.endpoint, p256dh: i.p256dh, auth: i.auth, criadoEm: agoraIso },
      update: { usuarioId, p256dh: i.p256dh, auth: i.auth },
    });
  });
}

/** Só apaga o aparelho se ele for da própria pessoa. */
export async function removerInscricao(usuarioId: string, endpoint: string): Promise<void> {
  await prisma.inscricaoPush.deleteMany({ where: { usuarioId, endpoint } });
}
