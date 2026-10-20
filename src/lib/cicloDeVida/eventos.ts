// Tipos de evento de produto registrados em EventoProduto. Só entra aqui o que o sistema de fato observa: nenhum
// evento é inventado e os de dinheiro (assinatura confirmada, checkout) só existirão quando houver cobrança real.

export const TIPOS_EVENTO = [
  "cadastro_concluido",
  "primeiro_acesso",
  "teste_iniciado",
  "teste_estendido",
  "teste_encerrado",
  "aviso_fim_teste_app",
  "email_enviado",
  "email_falhou",
  "email_descadastro",
  "onboarding_iniciado",
  "onboarding_concluido",
  "tutorial_visualizado",
  "item_checklist_concluido",
] as const;

export type TipoEvento = (typeof TIPOS_EVENTO)[number];
