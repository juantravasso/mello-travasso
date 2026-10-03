import "server-only";
import { prisma } from "@/lib/prisma";
import { verificarLimite } from "@/lib/auth/limite";
import { verificarSenha } from "@/lib/auth/senha";
import { ErroDeNegocio } from "./resultado.server";

const TENTATIVAS_POR_JANELA = 10;
const JANELA_MS = 10 * 60 * 1000;
const TENTATIVAS_POR_DIA = 30;
const UM_DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Reautenticação (step-up) para ação destrutiva de administração: a sessão do
 * admin dura 30 dias e renova sozinha, então uma sessão esquecida aberta não
 * pode ocultar conteúdo ou suspender perfil sem a senha. As tentativas são
 * limitadas, e a mensagem de erro não diz nada além de "senha incorreta".
 */
export async function exigirSenhaDoAdmin(usuarioId: string, senha: unknown): Promise<void> {
  if (typeof senha !== "string" || senha.length === 0 || senha.length > 200) {
    throw new ErroDeNegocio("Confirme sua senha para continuar.");
  }
  const limite = await verificarLimite(`admin-senha:${usuarioId}`, TENTATIVAS_POR_JANELA, JANELA_MS);
  const limiteDia = await verificarLimite(`admin-senha-dia:${usuarioId}`, TENTATIVAS_POR_DIA, UM_DIA_MS);
  if (!limite.permitido || !limiteDia.permitido) throw new ErroDeNegocio("Muitas tentativas de senha. Tente de novo mais tarde.");

  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { senhaHash: true } });
  if (!usuario || !(await verificarSenha(senha, usuario.senhaHash))) {
    // Falha auditada (nunca com a senha): ajuda a detectar sessão roubada em tentativa de palpite.
    await prisma.logAdmin.create({
      data: { adminUsuarioId: usuarioId, acao: "admin.reautenticacao_falha", alvoTipo: "Usuario", alvoId: usuarioId, detalhes: {}, criadoEm: new Date().toISOString() },
    });
    throw new ErroDeNegocio("Senha incorreta.");
  }
}
