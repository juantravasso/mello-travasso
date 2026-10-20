"use server";

import { prisma } from "@/lib/prisma";
import { exigirAdminAction } from "@/lib/auth/dal";
import { configCicloSchema, CHAVE_CONFIG_CICLO, type ConfigCicloDeVida } from "@/lib/cicloDeVida/config";
import { DIA_MS, diasAteOFim } from "@/lib/cicloDeVida/datas";
import { estenderTesteSchema } from "@/lib/validacao/admin";
import type { HistoricoTesteAdmin, OnboardingAdminItem, PainelCicloDeVidaAdmin, ResultadoAction, TesteDaEmpresaAdmin } from "@/types";
import { registrarLogAdmin } from "./adminLog.server";
import { nomeParaAdmin } from "./avaliacaoCore.server";
import { obterConfigCiclo } from "./cicloDeVidaCore.server";
import { estenderTeste, historicoDoTeste } from "./extensaoCore.server";
import { exigirSenhaDoAdmin } from "./reautenticacao.server";
import { ErroDeNegocio, executar } from "./resultado.server";

// Administração do ciclo de vida: configuração do teste e dos e-mails, extensão de teste e o que está acontecendo
// (testes perto do fim, quem está parado no onboarding, falhas de envio). Tudo exige administrador, e as ações que
// mudam algo pedem a senha de novo e entram no registro de ações.

function ocultarEmail(email: string): string {
  const [local = "", dominio = ""] = email.split("@");
  return `${local.slice(0, 1)}***@${dominio}`;
}

export async function obterPainelCicloDeVida(): Promise<ResultadoAction<PainelCicloDeVidaAdmin>> {
  await exigirAdminAction();
  return executar(async () => {
    const agora = new Date();
    const [config, empresasEmTeste, donosRecentes, porStatusBruto, falhasBrutas] = await Promise.all([
      obterConfigCiclo(),
      prisma.empresa.findMany({
        where: {
          plano: "teste",
          testeTerminaEm: { gte: new Date(agora.getTime() - 7 * DIA_MS).toISOString(), lte: new Date(agora.getTime() + 14 * DIA_MS).toISOString() },
        },
        select: {
          id: true,
          tipoPessoa: true,
          nomeFantasia: true,
          razaoSocial: true,
          testeTerminaEm: true,
          extensoesTeste: { select: { dias: true, fimAnterior: true }, orderBy: { criadoEm: "asc" } },
        },
        orderBy: { testeTerminaEm: "asc" },
        take: 100,
      }),
      prisma.usuario.findMany({
        where: { papel: "dono", criadoEm: { gte: new Date(agora.getTime() - 14 * DIA_MS).toISOString() }, empresa: { plano: { in: ["teste", "gratuito"] } } },
        select: {
          criadoEm: true,
          emailConfirmadoEm: true,
          empresa: { select: { id: true, tipoPessoa: true, nomeFantasia: true, razaoSocial: true, plano: true } },
        },
        orderBy: { criadoEm: "desc" },
        take: 50,
      }),
      prisma.emailAgendado.groupBy({ by: ["status"], where: { criadoEm: { gte: new Date(agora.getTime() - 30 * DIA_MS).toISOString() } }, _count: { _all: true } }),
      prisma.emailAgendado.findMany({
        where: { status: "falhou" },
        orderBy: { atualizadoEm: "desc" },
        take: 20,
        select: { id: true, campanha: true, tentativas: true, ultimoErro: true, criadoEm: true, usuario: { select: { email: true } } },
      }),
    ]);

    const testes: TesteDaEmpresaAdmin[] = empresasEmTeste.map((e) => {
      const fim = e.testeTerminaEm ? new Date(e.testeTerminaEm) : null;
      return {
        empresaId: e.id,
        nome: nomeParaAdmin(e),
        fimAtual: e.testeTerminaEm,
        fimOriginal: e.extensoesTeste[0]?.fimAnterior ?? e.testeTerminaEm,
        extensoes: e.extensoesTeste.length,
        diasEstendidos: e.extensoesTeste.reduce((soma, x) => soma + x.dias, 0),
        encerrado: fim ? fim.getTime() <= agora.getTime() : false,
        diasRestantes: fim ? diasAteOFim(fim, agora) : null,
      };
    });

    const ids = donosRecentes.map((d) => d.empresa.id);
    const [contas, obras, produtos, compromissos, perfis] = await Promise.all([
      prisma.contaFinanceira.groupBy({ by: ["empresaId"], where: { empresaId: { in: ids } }, _count: { _all: true } }),
      prisma.obra.groupBy({ by: ["empresaId"], where: { empresaId: { in: ids }, ehDeposito: false }, _count: { _all: true } }),
      prisma.produto.groupBy({ by: ["empresaId"], where: { empresaId: { in: ids } }, _count: { _all: true } }),
      prisma.compromisso.groupBy({ by: ["empresaId"], where: { empresaId: { in: ids } }, _count: { _all: true } }),
      prisma.perfilPublico.groupBy({ by: ["empresaId"], where: { empresaId: { in: ids }, status: "publicado" }, _count: { _all: true } }),
    ]);
    const contagem = (linhas: { empresaId: string | null; _count: { _all: number } }[]) => new Map(linhas.map((l) => [l.empresaId, l._count._all]));
    const [mContas, mObras, mProdutos, mCompromissos, mPerfis] = [contas, obras, produtos, compromissos, perfis].map(contagem);
    const onboarding: OnboardingAdminItem[] = donosRecentes.map((d) => ({
      empresaId: d.empresa.id,
      nome: nomeParaAdmin(d.empresa),
      plano: d.empresa.plano,
      criadoEm: d.criadoEm,
      emailConfirmado: d.emailConfirmadoEm !== null,
      contas: mContas?.get(d.empresa.id) ?? 0,
      obras: mObras?.get(d.empresa.id) ?? 0,
      produtos: mProdutos?.get(d.empresa.id) ?? 0,
      compromissos: mCompromissos?.get(d.empresa.id) ?? 0,
      perfilPublicado: (mPerfis?.get(d.empresa.id) ?? 0) > 0,
    }));

    return {
      config,
      testes,
      onboarding,
      emails: {
        porStatus: Object.fromEntries(porStatusBruto.map((l) => [l.status, l._count._all])),
        falhas: falhasBrutas.map((f) => ({ id: f.id, campanha: f.campanha, destino: ocultarEmail(f.usuario.email), tentativas: f.tentativas, erro: f.ultimoErro, criadoEm: f.criadoEm })),
      },
    };
  });
}

/** Salva a configuração. Ligar os e-mails grava o instante: dicas e boas-vindas só valem para quem se cadastrar depois. */
export async function salvarConfigCicloDeVida(entrada: unknown, motivo: string, senha?: string): Promise<ResultadoAction<ConfigCicloDeVida>> {
  const admin = await exigirAdminAction();
  return executar(async () => {
    const parsed = configCicloSchema.safeParse(entrada);
    if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Configuração inválida.");
    const textoMotivo = typeof motivo === "string" ? motivo.trim() : "";
    if (textoMotivo.length < 5) throw new ErroDeNegocio("Descreva o motivo (mínimo 5 letras).");
    await exigirSenhaDoAdmin(admin.usuarioId, senha);

    const agora = new Date().toISOString();
    return prisma.$transaction(async (tx) => {
      const linha = await tx.configuracaoPlataforma.findUnique({ where: { chave: CHAVE_CONFIG_CICLO } });
      const anterior = await obterConfigCiclo();
      const nova = parsed.data;
      // O instante de ativação nunca vem do formulário: liga → agora; desliga ou continua → mantém o que havia.
      const ativadoEm = nova.emails.ativos && !anterior.emails.ativos ? agora : anterior.emails.ativadoEm;
      const final: ConfigCicloDeVida = { ...nova, emails: { ...nova.emails, ativadoEm } };
      await tx.configuracaoPlataforma.upsert({
        where: { chave: CHAVE_CONFIG_CICLO },
        create: { chave: CHAVE_CONFIG_CICLO, valor: final, atualizadoEm: agora, atualizadoPorId: admin.usuarioId },
        update: { valor: final, atualizadoEm: agora, atualizadoPorId: admin.usuarioId },
      });
      await registrarLogAdmin(tx, admin.usuarioId, "ciclo_de_vida.salvar_config", "ConfiguracaoPlataforma", CHAVE_CONFIG_CICLO, {
        motivo: textoMotivo,
        existiaLinha: linha !== null,
        de: anterior,
        para: final,
      });
      return final;
    });
  });
}

export async function estenderTesteDaEmpresa(empresaId: string, dias: number, motivo: string, senha?: string): Promise<ResultadoAction<{ fimAnterior: string; fimNovo: string }>> {
  const admin = await exigirAdminAction();
  return executar(async () => {
    const parsed = estenderTesteSchema.safeParse({ empresaId, dias, motivo });
    if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    await exigirSenhaDoAdmin(admin.usuarioId, senha);
    return estenderTeste({ usuarioId: admin.usuarioId }, parsed.data);
  });
}

export async function obterHistoricoDoTeste(empresaId: string): Promise<ResultadoAction<HistoricoTesteAdmin>> {
  await exigirAdminAction();
  return executar(async () => {
    const parsed = estenderTesteSchema.shape.empresaId.safeParse(empresaId);
    if (!parsed.success) throw new ErroDeNegocio("Empresa não encontrada.");
    return historicoDoTeste(parsed.data);
  });
}
