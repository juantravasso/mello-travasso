import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { calcularStatusPlano, type StatusPlano } from "@/lib/auth/plano";
import { exigePublicarPerfil } from "@/lib/perfilObrigatorio";

// Regras de acesso que dependem só da EMPRESA (não da sessão): status do plano, recursos liberados e perfil pendente.
// Separadas do dal.ts para serem usadas também fora de uma requisição com sessão (ex.: mensagem do WhatsApp de um
// usuário vinculado) e em scripts de teste, sem puxar next/navigation. O dal.ts reexporta tudo.

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
 * O responsável pela conta ainda precisa publicar o perfil no Elo Profissionais (obrigatório uma vez, depois do cadastro)?
 * cache() por request: lido pelo layout e por toda ação dos módulos de gestão.
 */
export const perfilObrigatorioPendente = cache(async (empresaId: string, papel: "dono" | "membro", admin: boolean): Promise<boolean> => {
  if (papel !== "dono" || admin) return false;
  const [empresa, perfil, recursos] = await Promise.all([
    prisma.empresa.findUnique({ where: { id: empresaId }, select: { primeiraPublicacaoEm: true } }),
    prisma.perfilPublico.findUnique({ where: { empresaId }, select: { status: true } }),
    obterRecursosDaEmpresa(empresaId),
  ]);
  return exigePublicarPerfil({ papel, admin, statusPerfil: perfil?.status ?? null, jaPublicou: empresa?.primeiraPublicacaoEm != null, temRede: recursos.has("rede") });
});
