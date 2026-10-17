// Categorias e status dos compromissos: rótulos e cores. As cores usam os tokens do tema (claro e escuro).

export const CATEGORIAS = ["reuniao", "visita", "prazo", "financeiro", "pessoal", "outro"] as const;
export type CategoriaCompromisso = (typeof CATEGORIAS)[number];

export const STATUS_COMPROMISSO = ["agendado", "concluido", "cancelado"] as const;
export type StatusCompromisso = (typeof STATUS_COMPROMISSO)[number];

export const ROTULO_CATEGORIA: Record<CategoriaCompromisso, string> = {
  reuniao: "Reunião",
  visita: "Visita",
  prazo: "Prazo",
  financeiro: "Financeiro",
  pessoal: "Pessoal",
  outro: "Outro",
};

export const ROTULO_STATUS: Record<StatusCompromisso, string> = {
  agendado: "Agendado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

/** Classes do chip (fundo + texto) e do ponto de cada categoria. */
export const COR_CATEGORIA: Record<CategoriaCompromisso, { chip: string; ponto: string }> = {
  reuniao: { chip: "bg-info-bg text-info", ponto: "bg-info" },
  visita: { chip: "bg-primary/15 text-primary", ponto: "bg-primary" },
  prazo: { chip: "bg-warning-bg text-warning", ponto: "bg-warning" },
  financeiro: { chip: "bg-success-bg text-success", ponto: "bg-success" },
  pessoal: { chip: "bg-danger-bg text-danger", ponto: "bg-danger" },
  outro: { chip: "bg-muted-bg text-muted", ponto: "bg-muted" },
};
