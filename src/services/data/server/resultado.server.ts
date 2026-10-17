import "server-only";
import type { CodigoErro, ResultadoAction } from "@/types";

/**
 * Erro de regra de negócio com mensagem própria para o usuário. Em produção o
 * Next mascara a mensagem de qualquer erro lançado por uma Server Action, então
 * estes viram um ResultadoAction (que atravessa a rede normalmente). Erros de
 * autenticação/autorização e falhas inesperadas continuam sendo lançados.
 */
export class ErroDeNegocio extends Error {}

const AUTORIZACAO: Record<string, { erro: CodigoErro; mensagem: string }> = {
  NAO_AUTENTICADO: { erro: "NAO_AUTENTICADO", mensagem: "Sua sessão acabou. Entre de novo para continuar." },
  PLANO_SEM_ACESSO: { erro: "GENERICO", mensagem: "O plano da sua empresa não inclui este recurso." },
  SEM_PERMISSAO: { erro: "GENERICO", mensagem: "Você não tem permissão para fazer isso." },
  TROCA_SENHA_PENDENTE: { erro: "GENERICO", mensagem: "Defina uma nova senha para continuar usando o sistema." },
};

export async function executar<T>(corpo: () => Promise<T>): Promise<ResultadoAction<T>> {
  try {
    return { ok: true, dados: await corpo() };
  } catch (erro) {
    if (erro instanceof ErroDeNegocio) return { ok: false, erro: "VALIDACAO", mensagem: erro.message };
    // Falta de sessão ou de permissão volta como resultado: lançada, a mensagem some em produção
    // (o usuário só veria "Minified React error #441").
    if (erro instanceof Error && Object.hasOwn(AUTORIZACAO, erro.message)) return { ok: false, ...AUTORIZACAO[erro.message] };
    throw erro;
  }
}
