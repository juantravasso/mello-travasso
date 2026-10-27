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
  "oferta_visualizada",
  "oferta_clicada",
  "mp_webhook_recebido",
  "assinatura_mensal_ativada",
  "assinatura_mensal_cancelada",
  "pagamento_anual_confirmado",
  "pagamento_anual_recusado",
  "assinatura_renovacao_avisada",
  "assinatura_suspensa_vencimento",
  "assinatura_fim_do_acesso",
  "chamada_config_clicou",
  "chamada_config_agendada",
  "chamada_config_dispensada",
] as const;

export type TipoEvento = (typeof TIPOS_EVENTO)[number];
