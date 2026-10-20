import "server-only";
import { prisma } from "@/lib/prisma";
import { avaliarExtensao } from "@/lib/cicloDeVida/extensao";
import { fimDepoisDaExtensao } from "@/lib/cicloDeVida/datas";
import { formatarDataCompleta } from "@/lib/cicloDeVida/datas";
import type { ConfigCicloDeVida } from "@/lib/cicloDeVida/config";
import type { HistoricoTesteAdmin } from "@/types";
import { registrarLogAdmin } from "./adminLog.server";
import { obterConfigCiclo } from "./cicloDeVidaCore.server";
import { registrarEvento } from "./eventosCore.server";
import { ErroDeNegocio } from "./resultado.server";

// Extensão do teste concedida pela administração. A regra (quem pode, quanto, quantas vezes) está em
// src/lib/cicloDeVida/extensao.ts e vale AQUI, no servidor, dentro da transação: o front só mostra a mensagem.
// O novo fim só grava se o fim lido ainda for o atual, então duas extensões simultâneas não passam juntas.

export async function estenderTeste(
  admin: { usuarioId: string },
  entrada: { empresaId: string; dias: number; motivo: string },
  agora: Date = new Date(),
  /** Só os testes passam: em produção valem as regras da configuração do banco. */
  regrasFixas?: ConfigCicloDeVida["extensao"],
): Promise<{ fimAnterior: string; fimNovo: string }> {
  const regras = regrasFixas ?? (await obterConfigCiclo()).extensao;
  const iso = agora.toISOString();
  return prisma.$transaction(async (tx) => {
    const empresa = await tx.empresa.findUnique({
      where: { id: entrada.empresaId },
      select: { id: true, plano: true, testeTerminaEm: true, extensoesTeste: { select: { dias: true } } },
    });
    if (!empresa) throw new ErroDeNegocio("Empresa não encontrada.");
    const avaliacao = avaliarExtensao({
      config: regras,
      plano: empresa.plano,
      extensoesAnteriores: empresa.extensoesTeste.map((x) => x.dias),
      dias: entrada.dias,
    });
    if (!avaliacao.ok) throw new ErroDeNegocio(avaliacao.mensagem);
    if (!empresa.testeTerminaEm) throw new ErroDeNegocio("Esta empresa não tem data de fim de teste.");

    const fimAnterior = empresa.testeTerminaEm;
    const fimNovo = fimDepoisDaExtensao(new Date(fimAnterior), agora, entrada.dias).toISOString();
    const atualizada = await tx.empresa.updateMany({
      where: { id: empresa.id, plano: "teste", testeTerminaEm: fimAnterior },
      data: { testeTerminaEm: fimNovo, atualizadoEm: iso },
    });
    if (atualizada.count !== 1) throw new ErroDeNegocio("O teste mudou em outra aba. Recarregue a página.");

    const extensao = await tx.extensaoTeste.create({
      data: { empresaId: empresa.id, dias: entrada.dias, motivo: entrada.motivo, concedidaPorId: admin.usuarioId, fimAnterior, fimNovo, criadoEm: iso },
    });
    await registrarEvento(tx, { tipo: "teste_estendido", empresaId: empresa.id, usuarioId: admin.usuarioId, chave: `extensao:${extensao.id}`, dados: { dias: entrada.dias }, agora });
    await tx.notificacao.create({
      data: {
        empresaId: empresa.id,
        tipo: "teste_estendido",
        titulo: "Seu teste foi estendido",
        texto: `O novo término do teste é ${formatarDataCompleta(new Date(fimNovo))}.`,
        href: "/configuracoes",
        criadoEm: iso,
      },
    });
    const donos = await tx.usuario.findMany({
      where: { empresaId: empresa.id, papel: "dono", desativadoEm: null, bloqueadoPlataformaEm: null },
      select: { id: true },
    });
    if (donos.length > 0) {
      await tx.emailAgendado.createMany({
        data: donos.map((d) => ({
          empresaId: empresa.id,
          usuarioId: d.id,
          campanha: "teste_estendido",
          categoria: "transacional",
          chave: `${d.id}:extensao:${extensao.id}`,
          referencia: extensao.id,
          proximaTentativaEm: iso,
          criadoEm: iso,
          atualizadoEm: iso,
        })),
        skipDuplicates: true,
      });
    }
    // O motivo fica só no registro interno; o cliente vê apenas a nova data.
    await registrarLogAdmin(tx, admin.usuarioId, "empresa.estender_teste", "Empresa", empresa.id, {
      dias: entrada.dias,
      motivo: entrada.motivo,
      fimAnterior,
      fimNovo,
      extensaoId: extensao.id,
    });
    return { fimAnterior, fimNovo };
  });
}

export async function historicoDoTeste(empresaId: string): Promise<HistoricoTesteAdmin> {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { testeTerminaEm: true, extensoesTeste: { orderBy: { criadoEm: "asc" } } },
  });
  if (!empresa) throw new ErroDeNegocio("Empresa não encontrada.");
  const autores = await prisma.usuario.findMany({
    where: { id: { in: [...new Set(empresa.extensoesTeste.map((e) => e.concedidaPorId))] } },
    select: { id: true, nome: true },
  });
  const nomeDe = new Map(autores.map((a) => [a.id, a.nome]));
  return {
    fimAtual: empresa.testeTerminaEm,
    // O fim antes da primeira extensão; sem extensões, o próprio fim atual.
    fimOriginal: empresa.extensoesTeste[0]?.fimAnterior ?? empresa.testeTerminaEm,
    extensoes: empresa.extensoesTeste.map((e) => ({
      id: e.id,
      dias: e.dias,
      motivo: e.motivo,
      fimAnterior: e.fimAnterior,
      fimNovo: e.fimNovo,
      criadoEm: e.criadoEm,
      concedidaPor: nomeDe.get(e.concedidaPorId) ?? "Administrador removido",
    })),
  };
}
