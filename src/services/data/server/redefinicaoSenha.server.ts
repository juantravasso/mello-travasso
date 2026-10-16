import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { verificarLimite } from "@/lib/auth/limite";
import { gerarHash } from "@/lib/auth/senha";
import { enviarEmail, escaparHtml } from "@/lib/email/enviar.server";
import { registrarLogAdmin } from "./adminLog.server";
import { urlDoSite } from "@/lib/rede/site";

// Recuperação de senha. Mesmo desenho da confirmação de e-mail (token só em
// sha256 no banco, uso único, preso ao e-mail, link que abre um formulário),
// com validade curta de 1 h. Quem está bloqueado pela administração nunca
// recebe o link, e redefinir a senha não desbloqueia ninguém.

const TIPO = "redefinir_senha";
const VALIDADE_MS = 60 * 60 * 1000;
const UM_DIA_MS = 24 * 60 * 60 * 1000;
const LIMITE_GLOBAL_DIA = Number(process.env.EMAIL_LIMITE_DIARIO) > 0 ? Number(process.env.EMAIL_LIMITE_DIARIO) : 200;
// Metade da cota diária é o teto das redefinições: quem encher o balde de redefinição não impede
// as confirmações de e-mail dos cadastros (e vice-versa, pois o teto global vale para as duas).
const LIMITE_REDEFINICAO_DIA = Math.max(1, Math.floor(LIMITE_GLOBAL_DIA / 2));
// Links de redefinição válidos ao mesmo tempo por usuário: pedidos repetidos de terceiros não
// invalidam o link que a pessoa já recebeu (token de 256 bits só vai para a caixa dela).
const LINKS_VALIDOS_POR_USUARIO = 3;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Envia o link de redefinição se o e-mail pertence a uma conta ativa. Não diz
 * nada a quem chama sobre o resultado: a tela mostra sempre a mesma resposta.
 */
export async function enviarLinkDeRedefinicao(email: string): Promise<void> {
  const site = urlDoSite();
  if (process.env.NODE_ENV === "production" && !site.startsWith("https://")) {
    console.error("[email] NEXT_PUBLIC_SITE_URL ausente ou sem https em produção: redefinição não enviada.");
    return;
  }
  const usuario = await prisma.usuario.findUnique({
    where: { email },
    select: { id: true, nome: true, email: true, emailConfirmadoEm: true, bloqueadoPlataformaEm: true, empresa: { select: { bloqueadaEm: true } } },
  });
  if (!usuario || usuario.bloqueadoPlataformaEm || usuario.empresa.bloqueadaEm) return;

  const proprio = await verificarLimite("email-redefinicao-dia", LIMITE_REDEFINICAO_DIA, UM_DIA_MS);
  const global = await verificarLimite("email-global-dia", LIMITE_GLOBAL_DIA, UM_DIA_MS);
  if (!proprio.permitido || !global.permitido) {
    console.error("[email] teto diário de e-mails de redefinição ou global atingido.");
    return;
  }

  const token = randomBytes(32).toString("base64url");
  const agora = new Date();
  await prisma.$transaction(async (tx) => {
    const abertos = await tx.tokenEmail.findMany({
      where: { usuarioId: usuario.id, tipo: TIPO, usadoEm: null },
      orderBy: { criadoEm: "desc" },
      select: { id: true },
    });
    const excedentes = abertos.slice(LINKS_VALIDOS_POR_USUARIO - 1).map((t) => t.id);
    if (excedentes.length > 0) await tx.tokenEmail.deleteMany({ where: { id: { in: excedentes } } });
    await tx.tokenEmail.create({
      data: {
        usuarioId: usuario.id,
        tipo: TIPO,
        tokenHash: hashToken(token),
        email: usuario.email,
        expiraEm: new Date(agora.getTime() + VALIDADE_MS).toISOString(),
        criadoEm: agora.toISOString(),
      },
    });
  });

  const link = `${site}/redefinir-senha?token=${encodeURIComponent(token)}`;
  const nome = usuario.nome.split(" ")[0] ?? "";
  // Conta cujo e-mail nunca foi confirmado pode ter sido aberta por outra pessoa com este endereço.
  const avisoTexto = usuario.emailConfirmadoEm
    ? ""
    : "\n\nAtenção: esta conta nunca teve o e-mail confirmado. Se você não a criou, não abra o link e escreva para contato@mellotravasso.com.br.";
  const avisoHtml = usuario.emailConfirmadoEm
    ? ""
    : "<p><strong>Atenção:</strong> esta conta nunca teve o e-mail confirmado. Se você não a criou, não clique no botão e escreva para contato@mellotravasso.com.br.</p>";
  await enviarEmail({
    para: usuario.email,
    assunto: "Redefinição de senha na Mello e Travasso",
    texto:
      `Olá, ${nome}.\n\n` +
      `Recebemos um pedido para redefinir a sua senha. Para escolher uma nova, abra o link abaixo (vale por 1 hora):\n${link}\n\n` +
      `Se não foi você, ignore esta mensagem: a sua senha continua a mesma.` +
      avisoTexto,
    html:
      `<p>Olá, ${escaparHtml(nome)}.</p>` +
      `<p>Recebemos um pedido para redefinir a sua senha. Use o botão abaixo para escolher uma nova. O link vale por 1 hora.</p>` +
      `<p><a href="${escaparHtml(link)}" style="display:inline-block;padding:10px 18px;background:#1b2a49;color:#fff;border-radius:6px;text-decoration:none">Redefinir senha</a></p>` +
      `<p>Se o botão não abrir, copie este endereço no navegador:<br>${escaparHtml(link)}</p>` +
      `<p>Se não foi você, ignore esta mensagem: a sua senha continua a mesma.</p>` +
      avisoHtml,
  });
}

/** Avisa o dono da conta que a senha mudou: é como ele percebe uma troca que não fez. */
async function avisarSenhaAlterada(usuario: { nome: string; email: string }): Promise<void> {
  const nome = usuario.nome.split(" ")[0] ?? "";
  await enviarEmail({
    para: usuario.email,
    assunto: "Sua senha da Mello e Travasso foi alterada",
    texto:
      `Olá, ${nome}.\n\nA senha da sua conta acabou de ser alterada e todas as sessões abertas foram encerradas.\n\n` +
      `Se não foi você, peça outra redefinição agora em ${urlDoSite()}/esqueci-senha e fale com o suporte: contato@mellotravasso.com.br.`,
    html:
      `<p>Olá, ${escaparHtml(nome)}.</p>` +
      `<p>A senha da sua conta acabou de ser alterada e todas as sessões abertas foram encerradas.</p>` +
      `<p>Se não foi você, <a href="${escaparHtml(`${urlDoSite()}/esqueci-senha`)}">peça outra redefinição agora</a> e fale com o suporte: contato@mellotravasso.com.br.</p>`,
  });
}

export type ResultadoRedefinicao = "redefinida" | "invalido";

/**
 * Consome o token e grava a senha nova. "invalido" cobre inexistente, vencido,
 * já usado, e-mail trocado e conta bloqueada, sem distinguir. Ao concluir:
 * todas as sessões caem, a trava por falhas de login zera, e o e-mail passa a
 * contar como confirmado (quem recebeu o link controla a caixa de entrada).
 */
export async function redefinirSenhaComToken(token: string, senhaNova: string): Promise<ResultadoRedefinicao> {
  const registro = await prisma.tokenEmail.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      usuario: { select: { id: true, nome: true, email: true, emailConfirmadoEm: true, papelPlataforma: true, bloqueadoPlataformaEm: true, empresa: { select: { bloqueadaEm: true } } } },
    },
  });
  if (!registro || registro.tipo !== TIPO || registro.usadoEm) return "invalido";
  if (new Date(registro.expiraEm).getTime() <= Date.now()) return "invalido";
  const usuario = registro.usuario;
  if (usuario.email !== registro.email) return "invalido";
  if (usuario.bloqueadoPlataformaEm || usuario.empresa.bloqueadaEm) return "invalido";

  const novoHash = await gerarHash(senhaNova);
  const agora = new Date().toISOString();
  const resultado = await prisma.$transaction(async (tx) => {
    // updateMany com usadoEm null: duas abas com o mesmo link não passam juntas.
    // A expiração vai no próprio UPDATE: um token que vence entre a leitura e aqui não passa.
    const usado = await tx.tokenEmail.updateMany({ where: { id: registro.id, usadoEm: null, expiraEm: { gt: agora } }, data: { usadoEm: agora } });
    if (usado.count === 0) return "invalido" as const;
    await tx.usuario.update({
      where: { id: usuario.id },
      data: {
        senhaHash: novoHash,
        trocarSenha: false,
        falhasLogin: 0,
        bloqueadoAte: null,
        ultimaFalhaLoginEm: null,
        emailConfirmadoEm: usuario.emailConfirmadoEm ?? agora,
        atualizadoEm: agora,
      },
    });
    await tx.sessao.deleteMany({ where: { usuarioId: usuario.id } });
    // Administrador: a senha é a prova de identidade das ações de moderação, e aqui ela foi trocada por
    // posse da caixa de entrada. Fica registrado para quem audita a administração.
    if (usuario.papelPlataforma === "admin") {
      await registrarLogAdmin(tx, usuario.id, "usuario.senha_redefinida", "Usuario", usuario.id, { metodo: "link_por_email" });
    }
    // Qualquer outro link de redefinição ainda aberto deixa de valer.
    await tx.tokenEmail.deleteMany({ where: { usuarioId: usuario.id, tipo: TIPO, usadoEm: null } });
    return "redefinida" as const;
  });
  if (resultado === "redefinida") after(() => avisarSenhaAlterada(usuario).catch(() => undefined));
  return resultado;
}
