import "server-only";
import { prisma } from "@/lib/prisma";
import { temAlgumModulo, MODULOS, type ModuloChave } from "@/lib/auth/modulos";
import { DIA_MS } from "@/lib/cicloDeVida/datas";
import { ehChaveDeAjuda } from "@/lib/onboarding/ajuda";
import { calcularChecklist, resumirChecklist } from "@/lib/onboarding/checklist";
import { ESTADOS_TOUR, JANELA_TOUR_AUTOMATICO_DIAS, passosDoTour, type EstadoTour } from "@/lib/onboarding/tour";
import type { ChecklistOnboarding, EstadoOnboarding, TourComAjudas } from "@/types";
import { sinaisDaEmpresa } from "./cicloDeVidaCore.server";
import { registrarEvento } from "./eventosCore.server";
import { ErroDeNegocio } from "./resultado.server";

// Onboarding: tour, checklist de ativação e tutoriais. O progresso (estado do tour, checklist oculto, tutoriais
// vistos) fica em ProgressoOnboarding; o que está FEITO no checklist nunca é guardado como marcação, sai de fatos
// reais dos dados. A primeira vez que cada item aparece como feito vira um evento (uma vez por empresa).

export interface ContextoOnboarding {
  usuarioId: string;
  empresaId: string;
  papel: "dono" | "membro";
  modulos: readonly ModuloChave[];
  /** Recursos do plano da empresa (gestao, rede). */
  recursos: ReadonlySet<string>;
}

const pessoaDe = (ctx: ContextoOnboarding) => ({ papel: ctx.papel, modulos: ctx.modulos });

/** Tour e tutoriais vistos. Leve: não calcula o checklist (vai em toda página). */
export async function estadoDoTour(ctx: ContextoOnboarding, agora: Date = new Date()): Promise<TourComAjudas> {
  const [progresso, usuario] = await Promise.all([
    prisma.progressoOnboarding.findUnique({ where: { usuarioId: ctx.usuarioId } }),
    prisma.usuario.findUniqueOrThrow({ where: { id: ctx.usuarioId }, select: { criadoEm: true } }),
  ]);
  const estado = (ESTADOS_TOUR as readonly string[]).includes(progresso?.tourEstado ?? "") ? (progresso!.tourEstado as EstadoTour) : "nao_iniciado";
  const passos = passosDoTour(pessoaDe(ctx), ctx.recursos);
  const recente = agora.getTime() - Date.parse(usuario.criadoEm) <= JANELA_TOUR_AUTOMATICO_DIAS * DIA_MS;
  return {
    tour: {
      estado,
      passo: Math.min(Math.max(progresso?.tourPasso ?? 0, 0), Math.max(passos.length - 1, 0)),
      passos,
      abrirAutomaticamente: estado === "nao_iniciado" && recente,
    },
    ajudasVistas: [...new Set(progresso?.ajudasVistas ?? [])],
  };
}

/** Checklist de ativação: o "feito" vem de fatos reais dos dados; a primeira vez que um item aparece feito vira um evento. */
export async function estadoDoChecklist(ctx: ContextoOnboarding, agora: Date = new Date()): Promise<ChecklistOnboarding> {
  const [progresso, empresa] = await Promise.all([
    prisma.progressoOnboarding.findUnique({ where: { usuarioId: ctx.usuarioId }, select: { checklistOcultoEm: true } }),
    prisma.empresa.findUniqueOrThrow({ where: { id: ctx.empresaId }, select: { plano: true, telefone: true, cidade: true } }),
  ]);
  const sinais = await sinaisDaEmpresa(ctx.empresaId, empresa.plano);
  const itens = calcularChecklist({
    pessoa: pessoaDe(ctx),
    recursos: ctx.recursos,
    plano: empresa.plano,
    sinais: {
      obras: sinais.obras,
      contas: sinais.contas,
      produtos: sinais.produtos,
      compromissos: sinais.compromissos,
      perfilPublicado: sinais.perfilPublicado,
      dadosEmpresaCompletos: Boolean(empresa.telefone?.trim()) && Boolean(empresa.cidade?.trim()),
    },
  });
  const resumo = resumirChecklist(itens);

  // Primeira vez que um item aparece feito: um evento por empresa e item (a chave única impede repetir).
  const feitos = itens.filter((i) => i.feito);
  if (feitos.length > 0) {
    await prisma.eventoProduto.createMany({
      data: feitos.map((i) => ({ tipo: "item_checklist_concluido", empresaId: ctx.empresaId, chave: `item:${ctx.empresaId}:${i.id}`, dados: { item: i.id }, criadoEm: agora.toISOString() })),
      skipDuplicates: true,
    });
  }
  return { itens, feitos: resumo.feitos, total: resumo.total, proximoId: resumo.proximo?.id ?? null, oculto: progresso?.checklistOcultoEm != null };
}

export async function estadoDoOnboarding(ctx: ContextoOnboarding, agora: Date = new Date()): Promise<EstadoOnboarding> {
  const [tour, checklist] = await Promise.all([estadoDoTour(ctx, agora), estadoDoChecklist(ctx, agora)]);
  return { ...tour, checklist };
}

/** Guarda o estado e o passo do tour. A primeira saída de "não iniciado" vira o evento de onboarding iniciado; concluir, o de concluído. */
export async function atualizarTour(ctx: ContextoOnboarding, entrada: { estado: EstadoTour; passo: number }, agora: Date = new Date()): Promise<void> {
  if (!(ESTADOS_TOUR as readonly string[]).includes(entrada.estado)) throw new ErroDeNegocio("Estado do tour inválido.");
  const passos = passosDoTour(pessoaDe(ctx), ctx.recursos);
  if (!Number.isInteger(entrada.passo) || entrada.passo < 0 || entrada.passo >= Math.max(passos.length, 1)) throw new ErroDeNegocio("Passo do tour inválido.");
  const iso = agora.toISOString();
  await prisma.$transaction(async (tx) => {
    await tx.progressoOnboarding.upsert({
      where: { usuarioId: ctx.usuarioId },
      create: { usuarioId: ctx.usuarioId, tourEstado: entrada.estado, tourPasso: entrada.passo, criadoEm: iso, atualizadoEm: iso },
      update: { tourEstado: entrada.estado, tourPasso: entrada.passo, atualizadoEm: iso },
    });
    if (entrada.estado !== "nao_iniciado") {
      await registrarEvento(tx, { tipo: "onboarding_iniciado", empresaId: ctx.empresaId, usuarioId: ctx.usuarioId, chave: `onboarding-iniciado:${ctx.usuarioId}`, agora });
    }
    if (entrada.estado === "concluido") {
      await registrarEvento(tx, { tipo: "onboarding_concluido", empresaId: ctx.empresaId, usuarioId: ctx.usuarioId, chave: `onboarding-concluido:${ctx.usuarioId}`, agora });
    }
  });
}

export async function definirChecklistOculto(ctx: ContextoOnboarding, oculto: boolean, agora: Date = new Date()): Promise<void> {
  const iso = agora.toISOString();
  await prisma.progressoOnboarding.upsert({
    where: { usuarioId: ctx.usuarioId },
    create: { usuarioId: ctx.usuarioId, checklistOcultoEm: oculto ? iso : null, criadoEm: iso, atualizadoEm: iso },
    update: { checklistOcultoEm: oculto ? iso : null, atualizadoEm: iso },
  });
}

/** Marca o tutorial como visto. Só vale para módulo que a pessoa usa e que o plano inclui. Repetir não conta duas vezes. */
export async function registrarAjudaVista(ctx: ContextoOnboarding, chave: string, agora: Date = new Date()): Promise<void> {
  if (!ehChaveDeAjuda(chave)) throw new ErroDeNegocio("Tutorial não encontrado.");
  const modulo = MODULOS.find((m) => m.chave === chave);
  if (!modulo || !ctx.recursos.has(modulo.recurso) || !temAlgumModulo(pessoaDe(ctx), [chave])) throw new ErroDeNegocio("Este tutorial não está disponível para você.");
  const iso = agora.toISOString();
  const atual = await prisma.progressoOnboarding.findUnique({ where: { usuarioId: ctx.usuarioId }, select: { ajudasVistas: true } });
  if (!atual?.ajudasVistas.includes(chave)) {
    await prisma.progressoOnboarding.upsert({
      where: { usuarioId: ctx.usuarioId },
      create: { usuarioId: ctx.usuarioId, ajudasVistas: [chave], criadoEm: iso, atualizadoEm: iso },
      update: { ajudasVistas: { push: chave }, atualizadoEm: iso },
    });
  }
  await registrarEvento(prisma, { tipo: "tutorial_visualizado", empresaId: ctx.empresaId, usuarioId: ctx.usuarioId, chave: `tutorial:${ctx.usuarioId}:${chave}`, dados: { tutorial: chave }, agora });
}
