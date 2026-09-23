import { z } from "zod";

export const novaOpcaoPersonalizadaSchema = z
  .object({
    rotulo: z.string().trim().min(1, "Informe o rótulo").max(100),
  })
  .strict();

export const tipoContaSchema = z.enum(["pagar", "receber"]);
