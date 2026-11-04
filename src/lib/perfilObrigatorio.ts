// Depois do cadastro, o responsável pela conta precisa publicar o perfil no Elo Profissionais, ao menos uma vez, antes de
// usar o resto do sistema. Depois da primeira publicação ele pode despublicar quando quiser (os Termos prometem isso) sem
// ficar preso de novo. Regra pura (sem banco): quem decide é o servidor; o navegador só repete a conta para não deixar a
// pessoa navegar por telas que o servidor vai recusar.

/** Telas que continuam abertas enquanto o perfil não foi publicado: o próprio Elo Profissionais, Configurações (senha, sair) e Ajuda. */
export const ROTAS_LIBERADAS_SEM_PERFIL: readonly string[] = ["/minha-rede", "/configuracoes", "/ajuda"];

/** Para onde a pessoa vai quando tenta abrir outra tela. */
export const ROTA_DO_PERFIL = "/minha-rede/perfil";

export function rotaLiberadaSemPerfil(caminho: string): boolean {
  return ROTAS_LIBERADAS_SEM_PERFIL.some((r) => caminho === r || caminho.startsWith(`${r}/`));
}

export interface EntradaExigencia {
  papel: "dono" | "membro";
  /** Administrador da plataforma: nunca fica preso. */
  admin: boolean;
  /** Estado do perfil da empresa; null = ainda não foi aberto (ele nasce na primeira visita). */
  statusPerfil: string | null;
  /** A empresa já publicou o perfil alguma vez (gravado na primeira publicação). */
  jaPublicou: boolean;
  /** O plano da empresa inclui o Elo Profissionais; sem isso não há onde publicar. */
  temRede: boolean;
}

/**
 * Só o responsável (dono) é obrigado, e só até a primeira publicação. Perfil suspenso pela administração não volta a
 * publicar sozinho, então não pode prender a conta; empresa sem o recurso da rede não tem onde publicar.
 */
export function exigePublicarPerfil({ papel, admin, statusPerfil, jaPublicou, temRede }: EntradaExigencia): boolean {
  if (papel !== "dono" || admin || !temRede || jaPublicou) return false;
  return statusPerfil !== "suspenso";
}
