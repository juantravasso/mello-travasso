import "server-only";
import type { ResultadoAction } from "@/types";

/**
 * Erro de regra de negócio com mensagem própria para o usuário. Em produção o
 * Next mascara a mensagem de qualquer erro lançado por uma Server Action, então
 * estes viram um ResultadoAction (que atravessa a rede normalmente). Erros de
 * autenticação/autorização e falhas inesperadas continuam sendo lançados.
 */
export class ErroDeNegocio extends Error {}

export async function executar<T>(corpo: () => Promise<T>): Promise<ResultadoAction<T>> {
  try {
    return { ok: true, dados: await corpo() };
  } catch (erro) {
    if (erro instanceof ErroDeNegocio) return { ok: false, erro: "VALIDACAO", mensagem: erro.message };
    throw erro;
  }
}
