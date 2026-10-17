import "server-only";
import { prisma } from "@/lib/prisma";
import { devolverTentativa, verificarLimite } from "@/lib/auth/limite";
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
  await confirmarSenha(usuarioId, senha, "admin-senha", async () => {
    // Falha auditada (nunca com a senha): ajuda a detectar sessão roubada em tentativa de palpite.
    await prisma.logAdmin.create({
      data: { adminUsuarioId: usuarioId, acao: "admin.reautenticacao_falha", alvoTipo: "Usuario", alvoId: usuarioId, detalhes: {}, criadoEm: new Date().toISOString() },
    });
  });
}

/**
 * Mesma reautenticação para o dono da empresa em ações que dão acesso a outras pessoas (criar usuário,
 * redefinir acesso): uma sessão esquecida aberta não pode abrir uma porta nova sem a senha.
 */
export async function exigirSenhaDoDono(usuarioId: string, senha: unknown): Promise<void> {
  await confirmarSenha(usuarioId, senha, "dono-senha");
}

async function confirmarSenha(usuarioId: string, senha: unknown, prefixo: string, aoFalhar?: () => Promise<void>): Promise<void> {
  if (typeof senha !== "string" || senha.length === 0 || senha.length > 200) {
    throw new ErroDeNegocio("Confirme sua senha para continuar.");
  }
  const chaveJanela = `${prefixo}:${usuarioId}`;
  const chaveDia = `${prefixo}-dia:${usuarioId}`;
  // A tentativa é contada antes de conferir a senha (palpites em paralelo não escapam do teto) e
  // devolvida se a senha confere: o teto pesa sobre as falhas, não sobre quem trabalha na administração.
  const limite = await verificarLimite(chaveJanela, TENTATIVAS_POR_JANELA, JANELA_MS);
  const limiteDia = await verificarLimite(chaveDia, TENTATIVAS_POR_DIA, UM_DIA_MS);
  if (!limite.permitido || !limiteDia.permitido) throw new ErroDeNegocio("Muitas tentativas de senha. Tente de novo mais tarde.");

  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { senhaHash: true } });
  if (!usuario || !(await verificarSenha(senha, usuario.senhaHash))) {
    await aoFalhar?.();
    throw new ErroDeNegocio("Senha incorreta.");
  }
  await Promise.all([devolverTentativa(chaveJanela), devolverTentativa(chaveDia)]);
}
