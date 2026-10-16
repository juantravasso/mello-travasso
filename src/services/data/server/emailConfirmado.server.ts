import "server-only";
import type { SessaoValida } from "@/lib/auth/sessao";
import { ErroDeNegocio } from "./resultado.server";

/**
 * Barreira de e-mail confirmado para o que aparece para outras pessoas
 * (publicar perfil, avaliar, responder, recomendar, indicar, denunciar,
 * confirmar relação comercial). Desfazer — despublicar, remover recomendação —
 * nunca passa por aqui. `acao` completa a frase: "Confirme seu e-mail para ...".
 */
export function exigirEmailConfirmado(sessao: SessaoValida, acao: string): void {
  if (!sessao.emailConfirmado) {
    throw new ErroDeNegocio(`Confirme seu e-mail para ${acao}. Enviamos um link para ${sessao.email}.`);
  }
}
