"use server";

import { prisma } from "@/lib/prisma";
import { exigirAdminAction, exigirSessaoAction } from "@/lib/auth/dal";
import { CHAVE_CONFIG_CHAMADA, configChamadaSchema, ESTADOS_CHAMADA, type ConfigChamada, type EstadoChamada } from "@/lib/chamadaConfiguracao";
import type { ResultadoAction } from "@/types";
import { registrarLogAdmin } from "./adminLog.server";
import { obterConfigChamada, ofertaDaEmpresa } from "./chamadaConfiguracaoCore.server";
import { registrarEvento } from "./eventosCore.server";
import { exigirSenhaDoAdmin } from "./reautenticacao.server";
import { ErroDeNegocio, executar } from "./resultado.server";

// Convite para a chamada de configuração. Quem vê e responde é o responsável pela conta (dono); a administração
// liga o convite e cola o link da agenda.

/** O convite desta empresa (só o dono vê), ou null. */
export async function obterOfertaChamada(): Promise<ResultadoAction<{ url: string } | null>> {
  return executar(async () => {
    const sessao = await exigirSessaoAction();
    if (sessao.papel !== "dono") return null;
    return ofertaDaEmpresa(sessao.empresaId);
  });
}

/** Registra que a pessoa abriu a agenda (uma vez por empresa). */
export async function registrarCliqueChamada(): Promise<ResultadoAction<null>> {
  return executar(async () => {
    const sessao = await exigirSessaoAction();
    if (sessao.papel !== "dono") return null;
    await registrarEvento(prisma, { tipo: "chamada_config_clicou", empresaId: sessao.empresaId, usuarioId: sessao.usuarioId, chave: `chamada:clique:${sessao.empresaId}` });
    return null;
  });
}

/** "Já agendei" ou "Agora não": o convite some para esta empresa. */
export async function responderChamada(estado: EstadoChamada): Promise<ResultadoAction<null>> {
  return executar(async () => {
    const sessao = await exigirSessaoAction();
    if (sessao.papel !== "dono") throw new ErroDeNegocio("Só o responsável pela conta responde ao convite.");
    if (!ESTADOS_CHAMADA.includes(estado)) throw new ErroDeNegocio("Resposta inválida.");
    const agora = new Date().toISOString();
    const r = await prisma.empresa.updateMany({
      where: { id: sessao.empresaId, chamadaConfiguracaoEstado: null },
      data: { chamadaConfiguracaoEstado: estado, chamadaConfiguracaoEm: agora },
    });
    if (r.count === 1) {
      await registrarEvento(prisma, {
        tipo: estado === "agendada" ? "chamada_config_agendada" : "chamada_config_dispensada",
        empresaId: sessao.empresaId,
        usuarioId: sessao.usuarioId,
        chave: `chamada:${estado}:${sessao.empresaId}`,
      });
    }
    return null;
  });
}

// --- Administração ---

export async function obterConfigChamadaAdmin(): Promise<ResultadoAction<ConfigChamada & { convidadas: number; agendadas: number; dispensadas: number }>> {
  await exigirAdminAction();
  return executar(async () => {
    const [config, agrupado, total] = await Promise.all([
      obterConfigChamada(),
      prisma.empresa.groupBy({ by: ["chamadaConfiguracaoEstado"], _count: { _all: true } }),
      prisma.empresa.count(),
    ]);
    const contar = (estado: string) => agrupado.find((g) => g.chamadaConfiguracaoEstado === estado)?._count._all ?? 0;
    const agendadas = contar("agendada");
    const dispensadas = contar("dispensada");
    return { ...config, convidadas: total - agendadas - dispensadas, agendadas, dispensadas };
  });
}

export async function salvarConfigChamadaAdmin(entrada: unknown, motivo: string, senha?: string): Promise<ResultadoAction<ConfigChamada>> {
  const admin = await exigirAdminAction();
  return executar(async () => {
    const parsed = configChamadaSchema.safeParse(entrada);
    if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Configuração inválida.");
    const textoMotivo = typeof motivo === "string" ? motivo.trim() : "";
    if (textoMotivo.length < 5) throw new ErroDeNegocio("Descreva o motivo (mínimo 5 letras).");
    await exigirSenhaDoAdmin(admin.usuarioId, senha);

    const agora = new Date().toISOString();
    return prisma.$transaction(async (tx) => {
      const anterior = await tx.configuracaoPlataforma.findUnique({ where: { chave: CHAVE_CONFIG_CHAMADA } });
      await tx.configuracaoPlataforma.upsert({
        where: { chave: CHAVE_CONFIG_CHAMADA },
        create: { chave: CHAVE_CONFIG_CHAMADA, valor: parsed.data, atualizadoEm: agora, atualizadoPorId: admin.usuarioId },
        update: { valor: parsed.data, atualizadoEm: agora, atualizadoPorId: admin.usuarioId },
      });
      await registrarLogAdmin(tx, admin.usuarioId, "chamada_configuracao.salvar_config", "ConfiguracaoPlataforma", CHAVE_CONFIG_CHAMADA, {
        motivo: textoMotivo,
        existiaLinha: anterior !== null,
        de: anterior?.valor ?? null,
        para: parsed.data,
      });
      return parsed.data;
    });
  });
}
