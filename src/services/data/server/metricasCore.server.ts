import "server-only";
import { prisma } from "@/lib/prisma";
import { DIA_MS } from "@/lib/cicloDeVida/datas";
import { empresaAtivada, testeAmadurecido, testeConvertido } from "@/lib/metricas/formulas";
import type { MetricasCampanha, MetricasPlataforma } from "@/types";

// Métricas da plataforma para a administração. Tudo é lido do que existe (tabelas e eventos registrados pelo
// backend); nada é estimado. A leitura é por coorte: as empresas criadas no período e o que aconteceu com elas.

/** Teto de leitura por consulta; acima disso os números cobrem só os mais recentes e o painel avisa. */
const LIMITE_COORTE = 5000;

function contagem(linhas: { empresaId: string | null }[]): Set<string> {
  return new Set(linhas.map((l) => l.empresaId).filter((id): id is string => id !== null));
}

export async function calcularMetricas(periodoDias: number, agora: Date = new Date()): Promise<MetricasPlataforma> {
  const desde = new Date(agora.getTime() - periodoDias * DIA_MS).toISOString();
  const ate = agora.toISOString();

  const empresas = await prisma.empresa.findMany({
    where: { criadoEm: { gte: desde, lte: ate } },
    select: { id: true, convidadaPorId: true },
    orderBy: { criadoEm: "desc" },
    take: LIMITE_COORTE + 1,
  });
  const truncado = empresas.length > LIMITE_COORTE;
  const coorte = truncado ? empresas.slice(0, LIMITE_COORTE) : empresas;
  const ids = coorte.map((e) => e.id);

  const [donos, obras, contas, produtos, compromissos, perfis, iniciosDeTeste, primeiroEvento, filaPorStatus, descadastros] = await Promise.all([
    prisma.usuario.findMany({ where: { empresaId: { in: ids }, papel: "dono" }, select: { id: true, emailConfirmadoEm: true } }),
    prisma.obra.findMany({ where: { empresaId: { in: ids }, ehDeposito: false }, select: { empresaId: true }, distinct: ["empresaId"] }),
    prisma.contaFinanceira.findMany({ where: { empresaId: { in: ids } }, select: { empresaId: true }, distinct: ["empresaId"] }),
    prisma.produto.findMany({ where: { empresaId: { in: ids } }, select: { empresaId: true }, distinct: ["empresaId"] }),
    prisma.compromisso.findMany({ where: { empresaId: { in: ids } }, select: { empresaId: true }, distinct: ["empresaId"] }),
    prisma.perfilPublico.findMany({ where: { empresaId: { in: ids }, status: "publicado" }, select: { empresaId: true }, distinct: ["empresaId"] }),
    prisma.eventoProduto.findMany({
      where: { tipo: "teste_iniciado", criadoEm: { gte: desde, lte: ate }, empresaId: { not: null } },
      select: { empresaId: true },
      distinct: ["empresaId"],
      take: LIMITE_COORTE,
    }),
    prisma.eventoProduto.findFirst({ orderBy: { criadoEm: "asc" }, select: { criadoEm: true } }),
    prisma.emailAgendado.groupBy({ by: ["campanha", "status"], where: { criadoEm: { gte: desde, lte: ate } }, _count: { _all: true } }),
    prisma.eventoProduto.count({ where: { tipo: "email_descadastro", criadoEm: { gte: desde, lte: ate } } }),
  ]);

  // Coorte de cadastros: confirmação, ativação, indicação e tour.
  const temObra = contagem(obras);
  const temConta = contagem(contas);
  const temProduto = contagem(produtos);
  const temCompromisso = contagem(compromissos);
  const temPerfil = contagem(perfis);
  const ativadas = coorte.filter((e) =>
    empresaAtivada({
      obras: temObra.has(e.id) ? 1 : 0,
      contas: temConta.has(e.id) ? 1 : 0,
      produtos: temProduto.has(e.id) ? 1 : 0,
      compromissos: temCompromisso.has(e.id) ? 1 : 0,
      perfilPublicado: temPerfil.has(e.id),
    }),
  ).length;

  const progressos = await prisma.progressoOnboarding.findMany({ where: { usuarioId: { in: donos.map((d) => d.id) } }, select: { tourEstado: true } });
  const tour = { concluido: 0, pulado: 0, emAndamento: 0, naoIniciado: 0 };
  for (const p of progressos) {
    if (p.tourEstado === "concluido") tour.concluido++;
    else if (p.tourEstado === "pulado") tour.pulado++;
    else if (p.tourEstado === "em_andamento") tour.emAndamento++;
  }
  // Quem não tem linha nunca abriu o tour.
  tour.naoIniciado = donos.length - tour.concluido - tour.pulado - tour.emAndamento;

  // Coorte de testes iniciados no período (pode incluir empresas criadas antes, que ativaram o teste agora).
  const idsTeste = iniciosDeTeste.map((e) => e.empresaId).filter((id): id is string => id !== null);
  const empresasTeste = await prisma.empresa.findMany({
    where: { id: { in: idsTeste } },
    select: { id: true, plano: true, testeTerminaEm: true, extensoesTeste: { select: { dias: true } } },
  });
  const teste = {
    iniciados: empresasTeste.length,
    emAndamento: 0,
    amadurecidos: 0,
    convertidos: 0,
    comExtensao: { amadurecidos: 0, convertidos: 0 },
    semExtensao: { amadurecidos: 0, convertidos: 0 },
    extensoes: 0,
    diasEstendidos: 0,
  };
  for (const e of empresasTeste) {
    teste.extensoes += e.extensoesTeste.length;
    teste.diasEstendidos += e.extensoesTeste.reduce((soma, x) => soma + x.dias, 0);
    if (!testeAmadurecido(e, agora)) {
      teste.emAndamento++;
      continue;
    }
    const grupo = e.extensoesTeste.length > 0 ? teste.comExtensao : teste.semExtensao;
    const convertido = testeConvertido(e);
    teste.amadurecidos++;
    grupo.amadurecidos++;
    if (convertido) {
      teste.convertidos++;
      grupo.convertidos++;
    }
  }

  const porCampanha = new Map<string, MetricasCampanha>();
  for (const l of filaPorStatus) {
    const c = porCampanha.get(l.campanha) ?? { campanha: l.campanha, enviados: 0, falhas: 0, cancelados: 0, naFila: 0 };
    const n = l._count._all;
    if (l.status === "enviado") c.enviados += n;
    else if (l.status === "falhou") c.falhas += n;
    else if (l.status === "cancelado") c.cancelados += n;
    else c.naFila += n;
    porCampanha.set(l.campanha, c);
  }

  return {
    periodoDias,
    desde,
    ate,
    eventosDesde: primeiroEvento?.criadoEm ?? null,
    coorte: {
      cadastros: coorte.length,
      truncado,
      emailConfirmado: donos.filter((d) => d.emailConfirmadoEm !== null).length,
      ativadas,
      porIndicacao: coorte.filter((e) => e.convidadaPorId !== null).length,
      tour,
    },
    teste,
    emails: { campanhas: [...porCampanha.values()].sort((a, b) => a.campanha.localeCompare(b.campanha)), descadastros },
  };
}
