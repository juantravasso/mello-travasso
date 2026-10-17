import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { lerSessao, type SessaoValida } from "@/lib/auth/sessao";
import { calcularStatusPlano, type StatusPlano } from "@/lib/auth/plano";
import { temAlgumModulo, type ModuloChave } from "@/lib/auth/modulos";

// DAL (Data Access Layer) de autenticação — única fonte de identidade no
// servidor. Toda Server Action e toda página protegida chamam exigirSessao()
// (ou exigirEscrita()); nenhuma aceita usuarioId/empresaId vindo do client.
// cache() garante 1 leitura de sessão por request, mesmo com várias chamadas.

const obterSessao = cache(async (): Promise<SessaoValida | null> => lerSessao());

/**
 * Sessão se houver, sem redirecionar nem lançar — para páginas públicas que mudam conforme o visitante está
 * logado e para rotas que servem arquivos. Quem ainda não trocou a senha temporária conta como visitante
 * aqui: enquanto a troca não acontece, a conta não enxerga nada que dependa de login.
 */
export const obterSessaoOpcional = cache(async (): Promise<SessaoValida | null> => {
  const sessao = await obterSessao();
  return sessao && !sessao.trocaSenhaPendente ? sessao : null;
});

/**
 * Garante que existe uma sessão válida. Fora de uma rota (ex.: em página),
 * redireciona para /login?next=<rota atual> quando não há sessão — quem
 * chama de dentro de uma Server Action deve tratar o retorno null/erro,
 * já que redirect() dentro de uma action tem outro comportamento.
 */
export async function exigirSessao(next?: string): Promise<SessaoValida> {
  const sessao = await obterSessao();
  if (!sessao) {
    const destino = next && /^\/(?![\/\\])/.test(next) ? `/login?next=${encodeURIComponent(next)}` : "/login";
    redirect(destino);
  }
  return sessao;
}

/**
 * Igual a exigirSessao(), mas pensada para dentro de Server Actions, onde
 * redirect() não é o comportamento certo — devolve a sessão ou lança, para o
 * chamador decidir o formato do erro (CodigoErro "NAO_AUTENTICADO").
 */
export async function exigirSessaoAction(opcoes?: { permitirTrocaPendente?: boolean }): Promise<SessaoValida> {
  const sessao = await obterSessao();
  if (!sessao) {
    throw new Error("NAO_AUTENTICADO");
  }
  // Entrou com a senha temporária e ainda não a trocou: toda ação, API e leitura fica trancada, para
  // não bastar abrir outra rota ou chamar a ação direto. Só a troca de senha passa `permitirTrocaPendente`.
  if (sessao.trocaSenhaPendente && !opcoes?.permitirTrocaPendente) {
    throw new Error("TROCA_SENHA_PENDENTE");
  }
  return sessao;
}

/**
 * Consulta plano + testeTerminaEm da empresa e calcula o status (RF-15/16).
 * cache() por request: chamado por toda action de escrita e pela faixa do
 * teste, sem duplicar a query dentro do mesmo request.
 */
export const obterStatusPlano = cache(async (empresaId: string): Promise<StatusPlano> => {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { plano: true, testeTerminaEm: true },
  });
  // Não deveria acontecer (empresaId vem de uma sessão válida), mas por
  // segurança um registro sumido vira somente-leitura, nunca escrita liberada.
  if (!empresa) return { plano: "suspenso", diasRestantes: null, somenteLeitura: true, dataFimFormatada: null };
  return calcularStatusPlano(empresa);
});

/**
 * Igual a exigirSessaoAction(), e também bloqueia quando o teste já venceu
 * (RF-16) — lança "SOMENTE_LEITURA", que os chamadores tratam com a
 * mensagem "Teste encerrado — os dados continuam disponíveis para consulta."
 * A checagem no servidor é a barreira real; botões desabilitados na UI são
 * só o complemento (nunca confiar apenas no frontend).
 */
export async function exigirEscritaAction(): Promise<SessaoValida> {
  const sessao = await exigirSessaoAction();
  const status = await obterStatusPlano(sessao.empresaId);
  if (status.somenteLeitura) {
    throw new Error("SOMENTE_LEITURA");
  }
  return sessao;
}

export type ChaveRecurso = "rede" | "gestao";

/**
 * Recursos que o plano da empresa libera (tabela PlanoRecurso, configurável
 * pela administração). Falha fechada: plano sem linhas → nenhum recurso.
 * cache() por request, como obterStatusPlano.
 */
export const obterRecursosDaEmpresa = cache(async (empresaId: string): Promise<ReadonlySet<string>> => {
  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { plano: true } });
  if (!empresa) return new Set();
  const linhas = await prisma.planoRecurso.findMany({ where: { plano: empresa.plano }, select: { recursoChave: true } });
  return new Set(linhas.map((l) => l.recursoChave));
});

/**
 * Sessão + o plano da empresa precisa liberar os módulos de gestão (obras,
 * contas, estoque…) + a pessoa precisa ter ao menos um dos módulos listados (o
 * dono tem todos; o membro, os que o dono liberou). Sem lista, vale qualquer
 * módulo de gestão. Toda Server Action desses módulos usa esta função (ou a de
 * escrita abaixo) em vez de exigirSessaoAction() — a barreira real do plano e
 * dos módulos está aqui, no servidor; esconder o menu é só o complemento.
 */
export async function exigirGestaoAction(...modulos: ModuloChave[]): Promise<SessaoValida> {
  const sessao = await exigirSessaoAction();
  const recursos = await obterRecursosDaEmpresa(sessao.empresaId);
  if (!recursos.has("gestao")) throw new Error("PLANO_SEM_ACESSO");
  if (!temAlgumModulo(sessao, modulos.length > 0 ? modulos : undefined)) throw new Error("SEM_ACESSO_MODULO");
  return sessao;
}

/** Igual a exigirGestaoAction(), e também bloqueia quando o teste já venceu. */
export async function exigirGestaoEscritaAction(...modulos: ModuloChave[]): Promise<SessaoValida> {
  const sessao = await exigirGestaoAction(...modulos);
  const status = await obterStatusPlano(sessao.empresaId);
  if (status.somenteLeitura) throw new Error("SOMENTE_LEITURA");
  return sessao;
}

/**
 * Sessão + recurso "rede". Não olha o fim do teste: a rede profissional
 * continua livre mesmo depois que o teste dos módulos de gestão vence.
 */
export async function exigirRedeAction(): Promise<SessaoValida> {
  const sessao = await exigirSessaoAction();
  const recursos = await obterRecursosDaEmpresa(sessao.empresaId);
  if (!recursos.has("rede")) throw new Error("PLANO_SEM_ACESSO");
  if (!temAlgumModulo(sessao, ["rede"])) throw new Error("SEM_ACESSO_MODULO");
  return sessao;
}

/** Administrador da plataforma, para Server Actions. */
export async function exigirAdminAction(): Promise<SessaoValida> {
  const sessao = await exigirSessaoAction();
  if (!sessao.admin) throw new Error("SEM_PERMISSAO");
  return sessao;
}

/**
 * Administrador, para páginas. Quem não é admin recebe 404 (e não um
 * redirecionamento ou "acesso negado") para não confirmar que /admin existe.
 */
export async function exigirAdmin(): Promise<SessaoValida> {
  const sessao = await exigirSessao();
  if (!sessao.admin) notFound();
  return sessao;
}
