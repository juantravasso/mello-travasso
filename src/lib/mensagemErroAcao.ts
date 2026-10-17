const GENERICA = "Não foi possível concluir agora. Tente de novo.";

/**
 * Texto para mostrar quando uma Server Action lança em vez de devolver ResultadoAction.
 * Em produção o Next troca a mensagem por um texto técnico do React ("Minified React error #441…");
 * em desenvolvimento chegam os códigos internos (NAO_AUTENTICADO, SEM_PERMISSAO…). Nenhum dos dois
 * serve para o usuário.
 */
export function mensagemDeErro(erro: unknown): string {
  if (!(erro instanceof Error) || !erro.message) return GENERICA;
  const mensagem = erro.message;
  if (/^(NAO_|SEM_|PLANO_|SOMENTE_)/.test(mensagem)) return GENERICA;
  if (/minified react error|server components render|omitted in production/i.test(mensagem)) return GENERICA;
  return mensagem;
}
