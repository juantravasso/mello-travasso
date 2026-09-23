import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { lerSessao, type SessaoValida } from "@/lib/auth/sessao";
import { calcularStatusPlano, type StatusPlano } from "@/lib/auth/plano";

// DAL (Data Access Layer) de autenticação — única fonte de identidade no
// servidor. Toda Server Action e toda página protegida chamam exigirSessao()
// (ou exigirEscrita()); nenhuma aceita usuarioId/empresaId vindo do client.
// cache() garante 1 leitura de sessão por request, mesmo com várias chamadas.

const obterSessao = cache(async (): Promise<SessaoValida | null> => lerSessao());

/**
 * Garante que existe uma sessão válida. Fora de uma rota (ex.: em página),
 * redireciona para /login?next=<rota atual> quando não há sessão — quem
 * chama de dentro de uma Server Action deve tratar o retorno null/erro,
 * já que redirect() dentro de uma action tem outro comportamento.
 */
export async function exigirSessao(next?: string): Promise<SessaoValida> {
  const sessao = await obterSessao();
  if (!sessao) {
    const destino = next && /^\/(?!\/)/.test(next) ? `/login?next=${encodeURIComponent(next)}` : "/login";
    redirect(destino);
  }
  return sessao;
}

/**
 * Igual a exigirSessao(), mas pensada para dentro de Server Actions, onde
 * redirect() não é o comportamento certo — devolve a sessão ou lança, para o
 * chamador decidir o formato do erro (CodigoErro "NAO_AUTENTICADO").
 */
export async function exigirSessaoAction(): Promise<SessaoValida> {
  const sessao = await obterSessao();
  if (!sessao) {
    throw new Error("NAO_AUTENTICADO");
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
