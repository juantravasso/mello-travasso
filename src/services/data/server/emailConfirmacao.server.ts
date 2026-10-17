import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { verificarLimite } from "@/lib/auth/limite";
import { enviarEmail, escaparHtml } from "@/lib/email/enviar.server";
import { CORES_MARCA, MARCA } from "@/lib/marca";
import { urlDoSite } from "@/lib/rede/site";

// Confirmação de e-mail. O token vai por e-mail em claro e fica no banco só
// como sha256; vale 24 h, uma vez, e só enquanto o e-mail do usuário for o
// mesmo para o qual foi enviado. O link abre uma página com um botão (o GET não
// confirma nada): leitores de e-mail e antivírus que "visitam" links não gastam
// o token.

const TIPO = "confirmar_email";
const VALIDADE_MS = 24 * 60 * 60 * 1000;
const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;
const UM_DIA_MS = 24 * 60 * 60 * 1000;
// Teto global de e-mails por dia, abaixo da cota do provedor: impede que cadastros em massa
// esgotem a cota e deixem todo mundo sem conseguir confirmar. Ajustável por env.
const LIMITE_GLOBAL_DIA = Number(process.env.EMAIL_LIMITE_DIARIO) > 0 ? Number(process.env.EMAIL_LIMITE_DIARIO) : 200;
// Fração das emissões que também varre tokens velhos (sem índice em expiraEm, não vale a cada envio).
const CHANCE_DE_LIMPEZA = 0.05;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

interface UsuarioParaConfirmar {
  id: string;
  nome: string;
  email: string;
}

/** Gera um token novo (invalida os anteriores ainda não usados) e envia o link. true se o provedor aceitou. */
export async function emitirConfirmacaoDeEmail(usuario: UsuarioParaConfirmar): Promise<boolean> {
  // Em produção o link precisa ser https e do domínio real: sem isso o e-mail sairia com link morto (localhost).
  const site = urlDoSite();
  if (process.env.NODE_ENV === "production" && !site.startsWith("https://")) {
    console.error("[email] NEXT_PUBLIC_SITE_URL ausente ou sem https em produção: confirmação não enviada.");
    return false;
  }
  const global = await verificarLimite("email-global-dia", LIMITE_GLOBAL_DIA, UM_DIA_MS);
  if (!global.permitido) {
    console.error("[email] teto global diário de e-mails atingido.");
    return false;
  }

  const token = randomBytes(32).toString("base64url");
  const agora = new Date();
  await prisma.$transaction([
    prisma.tokenEmail.deleteMany({ where: { usuarioId: usuario.id, tipo: TIPO, usadoEm: null } }),
    prisma.tokenEmail.create({
      data: {
        usuarioId: usuario.id,
        tipo: TIPO,
        tokenHash: hashToken(token),
        email: usuario.email,
        expiraEm: new Date(agora.getTime() + VALIDADE_MS).toISOString(),
        criadoEm: agora.toISOString(),
      },
    }),
  ]);
  if (Math.random() < CHANCE_DE_LIMPEZA) {
    const corte = new Date(agora.getTime() - SETE_DIAS_MS).toISOString();
    await prisma.tokenEmail
      .deleteMany({ where: { OR: [{ expiraEm: { lt: corte } }, { usadoEm: { lt: corte } }] } })
      .catch(() => undefined);
  }

  const link = `${site}/confirmar-email?token=${encodeURIComponent(token)}`;
  const nome = usuario.nome.split(" ")[0] ?? "";
  return enviarEmail({
    para: usuario.email,
    assunto: `Confirme seu e-mail no ${MARCA.nome}`,
    texto:
      `Olá, ${nome}.\n\n` +
      `Para confirmar este e-mail e liberar a publicação no ${MARCA.produtos.profissionais.nome}, abra o link abaixo (vale por 24 horas):\n${link}\n\n` +
      `Se você não criou uma conta, não abra o link e ignore esta mensagem.`,
    html:
      `<p>Olá, ${escaparHtml(nome)}.</p>` +
      `<p>Para confirmar este e-mail e liberar a publicação no ${MARCA.produtos.profissionais.nome}, use o botão abaixo. O link vale por 24 horas.</p>` +
      `<p><a href="${escaparHtml(link)}" style="display:inline-block;padding:10px 18px;background:${CORES_MARCA.navy};color:#fff;border-radius:6px;text-decoration:none">Confirmar e-mail</a></p>` +
      `<p>Se o botão não abrir, copie este endereço no navegador:<br>${escaparHtml(link)}</p>` +
      `<p>Se você não criou uma conta, não clique no botão e ignore esta mensagem.</p>`,
  });
}

export type ResultadoConfirmacao = "confirmado" | "invalido";

/** Consome o token: marca o e-mail como confirmado. "invalido" cobre inexistente, vencido, já usado e e-mail trocado (sem distinguir). */
export async function consumirTokenDeConfirmacao(token: string): Promise<ResultadoConfirmacao> {
  const registro = await prisma.tokenEmail.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { usuario: { select: { id: true, email: true, emailConfirmadoEm: true } } },
  });
  if (!registro || registro.tipo !== TIPO || registro.usadoEm) return "invalido";
  if (new Date(registro.expiraEm).getTime() <= Date.now()) return "invalido";
  if (registro.usuario.email !== registro.email) return "invalido";

  const agora = new Date().toISOString();
  return prisma.$transaction(async (tx) => {
    // updateMany com usadoEm null: duas abas com o mesmo link não passam juntas.
    const usado = await tx.tokenEmail.updateMany({ where: { id: registro.id, usadoEm: null }, data: { usadoEm: agora } });
    if (usado.count === 0) return "invalido" as const;
    if (!registro.usuario.emailConfirmadoEm) {
      await tx.usuario.update({ where: { id: registro.usuario.id }, data: { emailConfirmadoEm: agora, atualizadoEm: agora } });
    }
    return "confirmado" as const;
  });
}
