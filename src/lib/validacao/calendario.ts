import { z } from "zod";
import { CATEGORIAS, STATUS_COMPROMISSO } from "@/lib/calendario/categorias";
import { diferencaEmDias, ehDataValida, ehHoraValida } from "@/lib/calendario/tempo";

export const MAX_PARTICIPANTES = 25;
/** O intervalo pedido a uma listagem (a grade mensal com margens cabe em 42 dias). */
export const MAX_DIAS_CONSULTA = 70;

const data = z.string().refine(ehDataValida, "Data inválida");
const hora = z.string().refine(ehHoraValida, "Horário inválido");

export const compromissoSchema = z
  .object({
    titulo: z.string().trim().min(1, "Informe o título do compromisso").max(120, "Título muito longo (máximo 120 caracteres)"),
    descricao: z.string().trim().max(2000, "Descrição muito longa (máximo 2000 caracteres)").optional(),
    categoria: z.enum(CATEGORIAS),
    data,
    diaInteiro: z.boolean(),
    horaInicio: hora.optional(),
    horaFim: hora.optional(),
    status: z.enum(STATUS_COMPROMISSO).default("agendado"),
    participantesIds: z.array(z.uuid("Participante inválido")).max(MAX_PARTICIPANTES, `No máximo ${MAX_PARTICIPANTES} participantes`).default([]),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (c.diaInteiro) {
      if (c.horaInicio || c.horaFim) ctx.addIssue({ code: "custom", path: ["horaInicio"], message: "Compromisso de dia inteiro não tem horário" });
      return;
    }
    if (!c.horaInicio) {
      ctx.addIssue({ code: "custom", path: ["horaInicio"], message: "Informe o horário de início" });
      return;
    }
    if (c.horaFim && c.horaFim <= c.horaInicio) {
      ctx.addIssue({ code: "custom", path: ["horaFim"], message: "O término precisa ser depois do início" });
    }
  });

export type CompromissoValidado = z.infer<typeof compromissoSchema>;

export const periodoSchema = z
  .object({ de: data, ate: data })
  .strict()
  .superRefine((p, ctx) => {
    if (!ehDataValida(p.de) || !ehDataValida(p.ate)) return;
    const dias = diferencaEmDias(p.de, p.ate);
    if (dias < 0) ctx.addIssue({ code: "custom", path: ["ate"], message: "O fim do período vem antes do início" });
    else if (dias > MAX_DIAS_CONSULTA) ctx.addIssue({ code: "custom", path: ["ate"], message: `Período grande demais (máximo ${MAX_DIAS_CONSULTA} dias)` });
  });

export const idSchema = z.object({ id: z.uuid("Compromisso não encontrado.") }).strict();

export const preferenciasSchema = z.object({ lembretesPorEmail: z.boolean(), lembretesNoApp: z.boolean() }).strict();
