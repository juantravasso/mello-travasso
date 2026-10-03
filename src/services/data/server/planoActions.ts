"use server";

import { prisma } from "@/lib/prisma";
import { exigirSessaoAction } from "@/lib/auth/dal";
import { calcularFimDoTeste } from "@/lib/auth/plano";
import type { ResultadoAction } from "@/types";

/**
 * Empresa do plano gratuito (só rede) começa o teste de 30 dias dos módulos
 * de gestão. O where com plano "gratuito" torna a troca atômica e única: quem
 * já está em teste, cortesia ou ativo não é afetado, e um duplo clique não
 * estende o prazo.
 */
export async function iniciarTesteGratis(): Promise<ResultadoAction<null>> {
  const sessao = await exigirSessaoAction();
  if (sessao.papel !== "dono") {
    return { ok: false, erro: "VALIDACAO", mensagem: "Só o responsável pela conta pode iniciar o teste." };
  }

  const agora = new Date().toISOString();
  const testeTerminaEm = calcularFimDoTeste();
  const resultado = await prisma.$transaction(async (tx) => {
    const atualizados = await tx.empresa.updateMany({
      where: { id: sessao.empresaId, plano: "gratuito" },
      data: { plano: "teste", testeTerminaEm, atualizadoEm: agora },
    });
    if (atualizados.count === 1) {
      await tx.eventoConta.create({
        data: {
          empresaId: sessao.empresaId,
          tipo: "teste_iniciado",
          detalhes: { usuarioId: sessao.usuarioId, testeTerminaEm },
          criadoEm: agora,
        },
      });
    }
    return atualizados.count;
  });

  if (resultado === 0) {
    return { ok: false, erro: "VALIDACAO", mensagem: "Este plano não permite iniciar o teste." };
  }
  return { ok: true, dados: null };
}
