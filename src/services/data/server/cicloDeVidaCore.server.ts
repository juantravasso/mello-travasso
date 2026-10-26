import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verificarLimite } from "@/lib/auth/limite";
import { enviarEmail, type MensagemEmail } from "@/lib/email/enviar.server";
import { ESPERA_ENTRE_TENTATIVAS_MIN, MAX_TENTATIVAS } from "@/lib/calendario/config";
import { urlDoSite } from "@/lib/rede/site";
import {
  campanhaSeAplica,
  CATEGORIA_DA_CAMPANHA,
  montarEmail,
  type CampanhaId,
  type SinaisDaEmpresa,
} from "@/lib/cicloDeVida/campanhas";
import { CHAVE_CONFIG_CICLO, lerConfigCiclo, type ConfigCicloDeVida } from "@/lib/cicloDeVida/config";
import {
  avisoDeFimEstaNaJanela,
  campanhaEstaDevida,
  DIA_MS,
  diasAteOFim,
  formatarDataCompleta,
  TOLERANCIA_CAMPANHA_MS,
} from "@/lib/cicloDeVida/datas";
import { ofertaDaEmpresa } from "./chamadaConfiguracaoCore.server";
import { registrarEvento } from "./eventosCore.server";

// Ciclo de vida do cliente: avisos de fim do teste, campanhas de e-mail e encerramento. Quem dispara (GitHub Actions,
// ver .github/workflows/ciclo-de-vida.yml) só chama processarCicloDeVida(): ela é idempotente e segura em paralelo.
//
//  1. Encerramentos: o teste que acabou vira evento (uma vez) e aviso no app.
//  2. Avisos de fim do teste: aviso no app e e-mail agendado para cada marco configurado (D-3, D-1, D0...).
//  3. Campanhas de onboarding: e-mails agendados conforme o tempo de cadastro e o que a empresa já fez.
//  4. Envio da fila, com reserva por UPDATE condicional, tentativas com espera crescente, teto por dia e controle
//     de frequência. Antes de enviar, cada e-mail é conferido de novo: se deixou de fazer sentido, é cancelado.
//
// A chave única de EmailAgendado impede duplicar o mesmo e-mail mesmo com dois processos ao mesmo tempo.

const RESERVA_MS = 5 * 60 * 1000;
const MS_MINUTO = 60_000;
const INTERVALO_PROMOCIONAL_MS = 2 * DIA_MS;
const LIMITE_DIARIO = Number(process.env.EMAIL_LIMITE_CICLO_DIA) > 0 ? Number(process.env.EMAIL_LIMITE_CICLO_DIA) : 50;
const CAMPANHAS_DE_ONBOARDING: CampanhaId[] = ["boas_vindas", "primeira_acao", "problema", "recursos"];

export type EnviadorEmail = (mensagem: MensagemEmail) => Promise<boolean>;

export interface OpcoesCiclo {
  agora?: Date;
  /** Substituível em teste; em produção é o envio real (Resend). */
  enviar?: EnviadorEmail;
  urlBase?: string;
  limiteEnvio?: number;
  /** Só a fase de envio (usada logo depois de confirmar o e-mail, para a boas-vindas sair na hora). */
  somenteEnvio?: boolean;
  /** Restringe a estas empresas. Só os testes usam (relógio simulado não pode tocar em dados reais). */
  apenasEmpresas?: string[];
  /** Os testes não podem gastar o teto diário de e-mails de verdade. */
  semTetoDiario?: boolean;
  /** Configuração fixa em vez da lida do banco. Só os testes usam (não mexem na configuração real). */
  config?: ConfigCicloDeVida;
}

export interface ResultadoCiclo {
  encerramentos: number;
  avisosNoApp: number;
  emailsAgendados: number;
  emailsEnviados: number;
  emailsReagendados: number;
  emailsFalhos: number;
  emailsCancelados: number;
}

export async function obterConfigCiclo(): Promise<ConfigCicloDeVida> {
  const linha = await prisma.configuracaoPlataforma.findUnique({ where: { chave: CHAVE_CONFIG_CICLO } });
  return lerConfigCiclo(linha?.valor);
}

export async function sinaisDaEmpresa(empresaId: string, plano: string): Promise<SinaisDaEmpresa> {
  const [contas, obras, produtos, compromissos, perfisPublicados] = await Promise.all([
    prisma.contaFinanceira.count({ where: { empresaId } }),
    prisma.obra.count({ where: { empresaId, ehDeposito: false } }),
    prisma.produto.count({ where: { empresaId } }),
    prisma.compromisso.count({ where: { empresaId } }),
    prisma.perfilPublico.count({ where: { empresaId, status: "publicado" } }),
  ]);
  return { plano, contas, obras, produtos, compromissos, perfilPublicado: perfisPublicados > 0 };
}

function maisMinutos(base: Date, minutos: number): string {
  return new Date(base.getTime() + minutos * MS_MINUTO).toISOString();
}

type BancoFila = Pick<Prisma.TransactionClient, "emailAgendado">;

/** Agenda a boas-vindas de quem acabou de confirmar o e-mail (uma por usuário; repetir não cria outra). */
export async function agendarBoasVindas(db: BancoFila, usuario: { id: string; empresaId: string }, agora: Date = new Date()): Promise<void> {
  const iso = agora.toISOString();
  await db.emailAgendado.createMany({
    data: [
      {
        empresaId: usuario.empresaId,
        usuarioId: usuario.id,
        campanha: "boas_vindas",
        categoria: CATEGORIA_DA_CAMPANHA.boas_vindas,
        chave: `${usuario.id}:boas_vindas`,
        proximaTentativaEm: iso,
        criadoEm: iso,
        atualizadoEm: iso,
      },
    ],
    skipDuplicates: true,
  });
}

// --- 1. Encerramentos ---------------------------------------------------------------

async function registrarEncerramentos(agora: Date, r: ResultadoCiclo, empresas?: string[]): Promise<void> {
  const iso = agora.toISOString();
  const encerradas = await prisma.empresa.findMany({
    where: {
      plano: "teste",
      bloqueadaEm: null,
      // Só os que acabaram há pouco: não revisita o histórico inteiro a cada execução.
      testeTerminaEm: { lte: iso, gte: new Date(agora.getTime() - 7 * DIA_MS).toISOString() },
      ...(empresas ? { id: { in: empresas } } : {}),
    },
    select: { id: true, testeTerminaEm: true },
    take: 200,
  });
  for (const e of encerradas) {
    if (!e.testeTerminaEm) continue;
    const criado = await prisma.$transaction(async (tx) => {
      const novo = await registrarEvento(tx, { tipo: "teste_encerrado", empresaId: e.id, chave: `encerrado:${e.id}:${e.testeTerminaEm}`, agora });
      if (!novo) return false;
      await tx.notificacao.create({
        data: {
          empresaId: e.id,
          tipo: "teste_encerrado",
          titulo: "Seu teste terminou",
          texto: "Seus dados continuam disponíveis para consulta. Para voltar a lançar e editar, fale com a equipe sobre como continuar.",
          href: "/configuracoes",
          criadoEm: iso,
        },
      });
      return true;
    });
    if (criado) r.encerramentos++;
  }
}

// --- 2. Avisos de fim do teste ------------------------------------------------------

async function donosAtivos(empresaId: string) {
  return prisma.usuario.findMany({
    where: { empresaId, papel: "dono", desativadoEm: null, bloqueadoPlataformaEm: null },
    select: { id: true },
  });
}

async function avisarFimDoTeste(agora: Date, config: ConfigCicloDeVida, r: ResultadoCiclo, empresas?: string[]): Promise<void> {
  if (!config.emails.fimDoTeste.ativa) return;
  const iso = agora.toISOString();
  const emTeste = await prisma.empresa.findMany({
    where: {
      plano: "teste",
      bloqueadaEm: null,
      testeTerminaEm: { gte: iso, lte: new Date(agora.getTime() + 20 * DIA_MS).toISOString() },
      ...(empresas ? { id: { in: empresas } } : {}),
    },
    select: { id: true, testeTerminaEm: true },
    take: 500,
  });

  for (const e of emTeste) {
    if (!e.testeTerminaEm) continue;
    const fim = new Date(e.testeTerminaEm);
    for (const d of config.emails.fimDoTeste.diasAntes) {
      if (!avisoDeFimEstaNaJanela(fim, d, agora)) continue;

      // Aviso dentro do app: uma vez por empresa e marco (a chave do evento garante).
      const criou = await prisma.$transaction(async (tx) => {
        const novo = await registrarEvento(tx, { tipo: "aviso_fim_teste_app", empresaId: e.id, chave: `aviso-app:${e.id}:${e.testeTerminaEm}:${d}`, dados: { diasAntes: d }, agora });
        if (!novo) return false;
        await tx.notificacao.create({
          data: {
            empresaId: e.id,
            tipo: "teste_fim",
            titulo: d === 0 ? "Seu teste termina hoje" : d === 1 ? "Seu teste termina amanhã" : `Seu teste termina em ${d} dias`,
            texto: `O teste termina em ${formatarDataCompleta(fim)}. Veja o que acontece depois e como continuar.`,
            href: "/configuracoes",
            criadoEm: iso,
          },
        });
        return true;
      });
      if (criou) r.avisosNoApp++;

      if (!config.emails.ativos) continue;
      for (const dono of await donosAtivos(e.id)) {
        const novos = await prisma.emailAgendado.createMany({
          data: [
            {
              empresaId: e.id,
              usuarioId: dono.id,
              campanha: "fim_do_teste",
              categoria: CATEGORIA_DA_CAMPANHA.fim_do_teste,
              chave: `${dono.id}:fim:${d}:${e.testeTerminaEm}`,
              referencia: e.testeTerminaEm,
              proximaTentativaEm: iso,
              criadoEm: iso,
              atualizadoEm: iso,
            },
          ],
          skipDuplicates: true,
        });
        r.emailsAgendados += novos.count;
      }
    }
  }
}

// --- 3. Campanhas de onboarding -----------------------------------------------------

function atrasoDaCampanha(config: ConfigCicloDeVida, c: CampanhaId): { ativa: boolean; aposDias: number } {
  const e = config.emails;
  switch (c) {
    case "boas_vindas":
      return { ativa: e.boasVindas.ativa, aposDias: 0 };
    case "primeira_acao":
      return e.primeiraAcao;
    case "problema":
      return e.problema;
    case "recursos":
      return e.recursos;
    default:
      return { ativa: false, aposDias: 0 };
  }
}

async function agendarCampanhas(agora: Date, config: ConfigCicloDeVida, r: ResultadoCiclo, empresas?: string[]): Promise<void> {
  if (!config.emails.ativos || !config.emails.ativadoEm) return;
  const iso = agora.toISOString();
  const desde = new Date(Math.max(Date.parse(config.emails.ativadoEm), agora.getTime() - 15 * DIA_MS)).toISOString();
  const donos = await prisma.usuario.findMany({
    where: {
      papel: "dono",
      desativadoEm: null,
      bloqueadoPlataformaEm: null,
      emailConfirmadoEm: { not: null },
      criadoEm: { gte: desde },
      empresa: { plano: { in: ["teste", "gratuito"] }, bloqueadaEm: null, ...(empresas ? { id: { in: empresas } } : {}) },
    },
    select: { id: true, empresaId: true, criadoEm: true, empresa: { select: { plano: true } } },
    take: 300,
  });

  for (const dono of donos) {
    let sinais: SinaisDaEmpresa | null = null;
    for (const campanha of CAMPANHAS_DE_ONBOARDING) {
      const { ativa, aposDias } = atrasoDaCampanha(config, campanha);
      if (!ativa || !campanhaEstaDevida(new Date(dono.criadoEm), aposDias, agora)) continue;
      sinais ??= await sinaisDaEmpresa(dono.empresaId, dono.empresa.plano);
      if (!campanhaSeAplica(campanha, sinais)) continue;
      const novos = await prisma.emailAgendado.createMany({
        data: [
          {
            empresaId: dono.empresaId,
            usuarioId: dono.id,
            campanha,
            categoria: CATEGORIA_DA_CAMPANHA[campanha],
            chave: `${dono.id}:${campanha}`,
            proximaTentativaEm: iso,
            criadoEm: iso,
            atualizadoEm: iso,
          },
        ],
        skipDuplicates: true,
      });
      r.emailsAgendados += novos.count;
    }
  }
}

// --- 4. Envio da fila ---------------------------------------------------------------

function campanhaAtiva(config: ConfigCicloDeVida, c: CampanhaId): boolean {
  if (c === "fim_do_teste") return config.emails.fimDoTeste.ativa;
  if (c === "teste_estendido") return true;
  return atrasoDaCampanha(config, c).ativa;
}

type Candidato = Prisma.EmailAgendadoGetPayload<{
  include: {
    usuario: { select: { nome: true; email: true; emailsPromocionais: true; tokenDescadastro: true; desativadoEm: true; bloqueadoPlataformaEm: true; emailConfirmadoEm: true; criadoEm: true } };
    empresa: { select: { plano: true; testeTerminaEm: true; bloqueadaEm: true } };
  };
}>;

async function cancelar(id: string, motivo: string, iso: string, r: ResultadoCiclo): Promise<void> {
  await prisma.emailAgendado.updateMany({ where: { id, status: "pendente" }, data: { status: "cancelado", ultimoErro: motivo, reservadoAte: null, atualizadoEm: iso } });
  r.emailsCancelados++;
}

/** Adia sem gastar tentativa: não é falha, o e-mail só ainda não pode sair. */
async function adiar(id: string, ate: string, iso: string, r?: ResultadoCiclo): Promise<void> {
  await prisma.emailAgendado.updateMany({ where: { id, status: "pendente" }, data: { proximaTentativaEm: ate, reservadoAte: null, atualizadoEm: iso } });
  if (r) r.emailsReagendados++;
}

async function registrarFalha(e: { id: string; tentativas: number; campanha: string; empresaId: string; usuarioId: string }, agora: Date, motivo: string, r: ResultadoCiclo): Promise<void> {
  const tentativas = e.tentativas + 1;
  const iso = agora.toISOString();
  if (tentativas >= MAX_TENTATIVAS) {
    await prisma.$transaction(async (tx) => {
      const marcado = await tx.emailAgendado.updateMany({ where: { id: e.id, status: "pendente" }, data: { status: "falhou", tentativas, ultimoErro: motivo, reservadoAte: null, atualizadoEm: iso } });
      if (marcado.count === 1) {
        await registrarEvento(tx, { tipo: "email_falhou", empresaId: e.empresaId, usuarioId: e.usuarioId, chave: `emailfalha:${e.id}`, dados: { campanha: e.campanha }, agora });
      }
    });
    r.emailsFalhos++;
    return;
  }
  const espera = ESPERA_ENTRE_TENTATIVAS_MIN[tentativas - 1] ?? ESPERA_ENTRE_TENTATIVAS_MIN[ESPERA_ENTRE_TENTATIVAS_MIN.length - 1] ?? 60;
  await prisma.emailAgendado.updateMany({
    where: { id: e.id, status: "pendente" },
    data: { tentativas, ultimoErro: motivo, proximaTentativaEm: maisMinutos(agora, espera), reservadoAte: null, atualizadoEm: iso },
  });
  r.emailsReagendados++;
}

/** Decide o destino de um e-mail da fila. Devolve "parar" quando o teto diário acabou. */
async function tratarEmail(e: Candidato, agora: Date, config: ConfigCicloDeVida, enviar: EnviadorEmail, urlBase: string, semTeto: boolean, r: ResultadoCiclo): Promise<"parar" | void> {
  const iso = agora.toISOString();
  const campanha = e.campanha as CampanhaId;
  const categoria = CATEGORIA_DA_CAMPANHA[campanha];
  if (!categoria) return cancelar(e.id, "campanha desconhecida", iso, r);

  // Chave geral desligada: nada sai e nada se perde; o e-mail espera.
  if (!config.emails.ativos) {
    await prisma.emailAgendado.updateMany({ where: { id: e.id, status: "pendente" }, data: { reservadoAte: null } });
    return;
  }

  const u = e.usuario;
  if (u.desativadoEm || u.bloqueadoPlataformaEm || e.empresa.bloqueadaEm) return cancelar(e.id, "conta inativa", iso, r);
  if (!u.emailConfirmadoEm) {
    // Não escreve para endereço não confirmado (pode ser digitado errado). Espera a confirmação até a tolerância.
    if (agora.getTime() - Date.parse(e.criadoEm) > TOLERANCIA_CAMPANHA_MS) return cancelar(e.id, "e-mail não confirmado", iso, r);
    return adiar(e.id, maisMinutos(agora, 60), iso, r);
  }
  if (categoria === "promocional" && !u.emailsPromocionais) return cancelar(e.id, "descadastrado", iso, r);
  if (!campanhaAtiva(config, campanha)) return cancelar(e.id, "campanha desativada", iso, r);
  if (CAMPANHAS_DE_ONBOARDING.includes(campanha) && (!config.emails.ativadoEm || u.criadoEm < config.emails.ativadoEm)) {
    return cancelar(e.id, "cadastro anterior ao início das campanhas", iso, r);
  }
  if (campanha === "fim_do_teste" && (e.empresa.plano !== "teste" || e.empresa.testeTerminaEm !== e.referencia)) {
    return cancelar(e.id, "o fim do teste mudou", iso, r);
  }

  const sinais = await sinaisDaEmpresa(e.empresaId, e.empresa.plano);
  if (!campanhaSeAplica(campanha, sinais)) return cancelar(e.id, "já não se aplica", iso, r);

  // Controle de frequência: no máximo um e-mail promocional a cada 2 dias por pessoa.
  if (categoria === "promocional") {
    const recente = await prisma.emailAgendado.count({
      where: { usuarioId: e.usuarioId, categoria: "promocional", status: "enviado", enviadoEm: { gte: new Date(agora.getTime() - INTERVALO_PROMOCIONAL_MS).toISOString() } },
    });
    if (recente > 0) return adiar(e.id, maisMinutos(agora, 24 * 60), iso, r);
  }

  if (!semTeto) {
    const teto = await verificarLimite("email-ciclo-dia", LIMITE_DIARIO, DIA_MS);
    if (!teto.permitido) {
      await prisma.emailAgendado.updateMany({ where: { id: e.id, status: "pendente" }, data: { reservadoAte: null } });
      return "parar";
    }
  }

  let diasExtensao: number | undefined;
  let fimDaExtensao: string | null = null;
  if (campanha === "teste_estendido") {
    const ext = e.referencia ? await prisma.extensaoTeste.findUnique({ where: { id: e.referencia }, select: { dias: true, fimNovo: true } }) : null;
    if (!ext || e.empresa.plano !== "teste") return cancelar(e.id, "extensão não encontrada", iso, r);
    diasExtensao = ext.dias;
    fimDaExtensao = ext.fimNovo;
  }
  const fimIso = fimDaExtensao ?? (campanha === "fim_do_teste" ? e.referencia : e.empresa.testeTerminaEm);
  const fim = fimIso ? new Date(fimIso) : null;

  // Convite para a chamada de configuração: só na boas-vindas, com a função ligada e a empresa ainda sem resposta.
  const oferecerChamada = campanha === "boas_vindas" && (await ofertaDaEmpresa(e.empresaId)) !== null;

  const montado = montarEmail(campanha, {
    oferecerChamada,
    nome: u.nome,
    urlSite: urlBase,
    sinais,
    diasDeTeste: config.testeDias,
    fimFormatado: fim ? formatarDataCompleta(fim) : undefined,
    diasRestantes: campanha === "fim_do_teste" && fim ? Math.max(0, diasAteOFim(fim, agora)) : undefined,
    diasExtensao,
    linkDescadastro: categoria === "promocional" ? `${urlBase}/descadastrar/${u.tokenDescadastro}` : undefined,
  });

  const aceito = await enviar({
    para: u.email,
    assunto: montado.assunto,
    texto: montado.texto,
    html: montado.html,
    // A chave do provedor descarta um reenvio causado por queda entre o envio e o registro.
    chaveIdempotencia: `ciclo-${e.id}`,
    cabecalhos:
      categoria === "promocional"
        ? { "List-Unsubscribe": `<${urlBase}/api/descadastrar/${u.tokenDescadastro}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
        : undefined,
  });
  if (!aceito) return registrarFalha(e, agora, "provedor de e-mail recusou ou está indisponível", r);

  await prisma.$transaction(async (tx) => {
    const marcado = await tx.emailAgendado.updateMany({
      where: { id: e.id, status: "pendente" },
      data: { status: "enviado", tentativas: e.tentativas + 1, enviadoEm: iso, ultimoErro: null, reservadoAte: null, atualizadoEm: iso },
    });
    if (marcado.count === 1) {
      await registrarEvento(tx, { tipo: "email_enviado", empresaId: e.empresaId, usuarioId: e.usuarioId, chave: `email:${e.id}`, dados: { campanha, categoria }, agora });
      r.emailsEnviados++;
    }
  });
}

async function enviarPendentes(agora: Date, config: ConfigCicloDeVida, enviar: EnviadorEmail, urlBase: string, limite: number, semTeto: boolean, r: ResultadoCiclo, empresas?: string[]): Promise<void> {
  const iso = agora.toISOString();
  const candidatos = await prisma.emailAgendado.findMany({
    where: {
      status: "pendente",
      proximaTentativaEm: { lte: iso },
      OR: [{ reservadoAte: null }, { reservadoAte: { lt: iso } }],
      ...(empresas ? { empresaId: { in: empresas } } : {}),
    },
    orderBy: [{ proximaTentativaEm: "asc" }, { id: "asc" }],
    take: limite,
    include: {
      usuario: { select: { nome: true, email: true, emailsPromocionais: true, tokenDescadastro: true, desativadoEm: true, bloqueadoPlataformaEm: true, emailConfirmadoEm: true, criadoEm: true } },
      empresa: { select: { plano: true, testeTerminaEm: true, bloqueadaEm: true } },
    },
  });

  for (const e of candidatos) {
    // Reserva: só um processamento consegue pegar o item; a reserva vence sozinha se o processo cair.
    const reservado = await prisma.emailAgendado.updateMany({
      where: { id: e.id, status: "pendente", OR: [{ reservadoAte: null }, { reservadoAte: { lt: iso } }] },
      data: { reservadoAte: maisMinutos(agora, RESERVA_MS / MS_MINUTO), atualizadoEm: iso },
    });
    if (reservado.count !== 1) continue;
    try {
      if ((await tratarEmail(e, agora, config, enviar, urlBase, semTeto, r)) === "parar") return;
    } catch (erro) {
      // Só o tipo do erro: nada de e-mail, token ou corpo da mensagem em log.
      console.error("[ciclo-de-vida] falha ao enviar:", erro instanceof Error ? erro.name : "erro");
      await registrarFalha(e, agora, "erro interno ao enviar", r);
    }
  }
}

export async function processarCicloDeVida(opcoes: OpcoesCiclo = {}): Promise<ResultadoCiclo> {
  const agora = opcoes.agora ?? new Date();
  const r: ResultadoCiclo = { encerramentos: 0, avisosNoApp: 0, emailsAgendados: 0, emailsEnviados: 0, emailsReagendados: 0, emailsFalhos: 0, emailsCancelados: 0 };
  const config = opcoes.config ?? (await obterConfigCiclo());
  if (!opcoes.somenteEnvio) {
    await registrarEncerramentos(agora, r, opcoes.apenasEmpresas);
    await avisarFimDoTeste(agora, config, r, opcoes.apenasEmpresas);
    await agendarCampanhas(agora, config, r, opcoes.apenasEmpresas);
  }
  await enviarPendentes(agora, config, opcoes.enviar ?? enviarEmail, opcoes.urlBase ?? urlDoSite(), opcoes.limiteEnvio ?? 40, opcoes.semTetoDiario ?? false, r, opcoes.apenasEmpresas);
  return r;
}

// --- Preferência de comunicação -----------------------------------------------------

/** Link de descadastro: desliga as comunicações promocionais de quem tem este token e cancela as pendentes. false se o token não existe. */
export async function descadastrarPorToken(token: string, agora: Date = new Date()): Promise<boolean> {
  if (typeof token !== "string" || token.length < 8 || token.length > 100) return false;
  const u = await prisma.usuario.findUnique({ where: { tokenDescadastro: token }, select: { id: true, empresaId: true } });
  if (!u) return false;
  await definirEmailsPromocionais(u.id, u.empresaId, false, agora);
  return true;
}

export async function definirEmailsPromocionais(usuarioId: string, empresaId: string, valor: boolean, agora: Date = new Date()): Promise<void> {
  const iso = agora.toISOString();
  await prisma.$transaction(async (tx) => {
    const mudou = await tx.usuario.updateMany({ where: { id: usuarioId, emailsPromocionais: !valor }, data: { emailsPromocionais: valor, atualizadoEm: iso } });
    if (valor) return;
    await tx.emailAgendado.updateMany({
      where: { usuarioId, categoria: "promocional", status: "pendente" },
      data: { status: "cancelado", ultimoErro: "descadastrado", reservadoAte: null, atualizadoEm: iso },
    });
    if (mudou.count === 1) {
      await registrarEvento(tx, { tipo: "email_descadastro", usuarioId, empresaId, chave: `descadastro:${usuarioId}:${iso.slice(0, 10)}`, agora });
    }
  });
}
