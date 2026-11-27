import "server-only";
import { temAlgumModulo } from "@/lib/auth/modulos";
import type { ContextoContas } from "../contasCore.server";
import { FERRAMENTAS_DE_ESCRITA } from "./escrita.server";
import { FERRAMENTAS_DE_LEITURA, type Ferramenta } from "./ferramentas.server";

// Todas as ferramentas do assistente. A ordem não muda entre mensagens (a lista vai em cache na API).
export const FERRAMENTAS: readonly Ferramenta[] = [...FERRAMENTAS_DE_LEITURA, ...FERRAMENTAS_DE_ESCRITA];

/** Só as ferramentas que a pessoa pode usar vão para a IA (quem não vê contas nem fica sabendo que elas existem). */
export function ferramentasDaPessoa(ctx: ContextoContas): Ferramenta[] {
  return FERRAMENTAS.filter((f) => temAlgumModulo(ctx, f.modulos));
}
