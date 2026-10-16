import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirRedeAction } from "@/lib/auth/dal";
import { extrairIpConfiavel, verificarLimite } from "@/lib/auth/limite";
import { sanearImagem, type TipoImagem } from "./armazenamento.server";
import { cifrarDocumento, cifraDeDocumentosConfigurada } from "./documentoCifra.server";
import { lerFormularioLimitado, type RespostaUpload } from "./uploadPortfolio.server";
import {
  detectarTipoDocumento,
  MAX_DOCUMENTOS_POR_PEDIDO,
  pdfTemConteudoAtivo,
  TAMANHO_MAXIMO_DOCUMENTO_BYTES,
  travarEmpresa,
  travarPedidoPendente,
} from "./verificacaoCore.server";

// Envio de documento de verificação. Rota de API (não Server Action) para limitar o
// tamanho do corpo antes de ler. A identidade vem da sessão; o pedido tem de ser
// da empresa logada e estar pendente. O arquivo é cifrado antes de ir ao banco e
// nunca é servido a ninguém além da administração.

const DOCUMENTOS_POR_DIA = 10;
const DOCUMENTOS_POR_IP_POR_DIA = 30;
/** Teto de armazenamento de documentos ainda guardados (todos os pedidos pendentes somados). */
const TETO_GLOBAL_BYTES = 300 * 1024 * 1024;
const MARGEM_MULTIPART_BYTES = 64 * 1024;
const UM_DIA_MS = 24 * 60 * 60 * 1000;

const campos = z.object({ solicitacaoId: z.string().uuid() }).strict();

function erro(mensagem: string, status: number): RespostaUpload {
  return { status, corpo: { ok: false, mensagem } };
}

const MENSAGEM_GRANDE = `O documento é grande demais (máximo ${TAMANHO_MAXIMO_DOCUMENTO_BYTES / (1024 * 1024)} MB). Reduza ou comprima o arquivo.`;

export async function receberDocumento(request: Request): Promise<RespostaUpload> {
  // Defesa extra contra CSRF (o cookie já é SameSite=Lax): origem ou contexto de outro site, recusa.
  const origem = request.headers.get("origin");
  if (origem && origem !== new URL(request.url).origin) return erro("Origem não permitida.", 403);
  if (request.headers.get("sec-fetch-site") === "cross-site") return erro("Origem não permitida.", 403);

  const tamanhoDeclarado = Number(request.headers.get("content-length"));
  if (!Number.isFinite(tamanhoDeclarado) || tamanhoDeclarado <= 0) return erro("Envie o documento de novo.", 411);
  const teto = TAMANHO_MAXIMO_DOCUMENTO_BYTES + MARGEM_MULTIPART_BYTES;
  if (tamanhoDeclarado > teto) return erro(MENSAGEM_GRANDE, 413);

  let sessao;
  try {
    sessao = await exigirRedeAction();
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "";
    if (mensagem === "PLANO_SEM_ACESSO") return erro("Seu plano não inclui a rede.", 403);
    if (mensagem === "NAO_AUTENTICADO") return erro("Entre para enviar documentos.", 401);
    throw e;
  }
  if (!sessao.emailConfirmado) return erro("Confirme seu e-mail para enviar documentos.", 403);
  // Quem fala pela empresa à administração é o dono da conta, não qualquer usuário dela.
  if (sessao.papel !== "dono") return erro("Só o dono da conta envia documentos de verificação.", 403);
  if (!cifraDeDocumentosConfigurada()) return erro("O envio de documentos está indisponível no momento.", 503);

  const limite = await verificarLimite(`rede-documento:${sessao.empresaId}`, DOCUMENTOS_POR_DIA, UM_DIA_MS);
  if (!limite.permitido) return erro("Muitos envios hoje. Tente de novo amanhã.", 429);
  // IP desconhecido não entra no balde por IP: viraria um teto global compartilhado.
  const ip = extrairIpConfiavel(request.headers);
  if (ip !== "desconhecido") {
    const porIp = await verificarLimite(`rede-documento-ip:${ip}`, DOCUMENTOS_POR_IP_POR_DIA, UM_DIA_MS);
    if (!porIp.permitido) return erro("Muitos envios a partir desta rede hoje. Tente de novo amanhã.", 429);
  }
  const guardado = await prisma.arquivo.aggregate({ where: { finalidade: "documento", apagadoEm: null }, _sum: { tamanho: true } });
  if ((guardado._sum.tamanho ?? 0) >= TETO_GLOBAL_BYTES) return erro("O envio de documentos está indisponível no momento. Tente mais tarde.", 503);

  const formulario = await lerFormularioLimitado(request, teto);
  if (formulario === "grande") return erro(MENSAGEM_GRANDE, 413);
  if (formulario === "invalido") return erro("Envio inválido.", 400);

  const parsed = campos.safeParse({ solicitacaoId: formulario.get("solicitacaoId") });
  const arquivo = formulario.get("arquivo");
  if (!parsed.success || !(arquivo instanceof File)) return erro("Envio inválido.", 400);
  if (arquivo.size <= 0 || arquivo.size > TAMANHO_MAXIMO_DOCUMENTO_BYTES) return erro(MENSAGEM_GRANDE, 413);

  const original = new Uint8Array(await arquivo.arrayBuffer());
  const tipo = detectarTipoDocumento(original);
  if (!tipo) return erro("Use um PDF ou uma imagem JPG, PNG ou WebP.", 415);
  // Imagem: remove EXIF/GPS e confere a estrutura. PDF: recusado se trouxer, de forma legível,
  // conteúdo ativo (script, abrir/lançar, anexo); o resto segue como veio, cifrado, e só a
  // administração o baixa (nunca é aberto no navegador dentro do app).
  let conteudo: Uint8Array = original;
  if (tipo === "application/pdf") {
    if (pdfTemConteudoAtivo(original)) return erro("Este PDF tem conteúdo ativo (script, anexo ou ação automática). Gere um PDF simples ou envie uma foto do documento.", 415);
  } else {
    const limpa = sanearImagem(original, tipo as TipoImagem, TAMANHO_MAXIMO_DOCUMENTO_BYTES);
    if (!limpa) return erro("Não foi possível aceitar essa imagem (ou ela ficou grande demais). Use uma foto ou digitalização comum.", 415);
    conteudo = limpa;
  }
  const sha256 = createHash("sha256").update(conteudo).digest("hex");

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      // O lock da empresa serializa os envios dela (o limite de documentos vale sob concorrência) e o do
      // pedido o serializa com a decisão: o documento entra antes e é apagado com ela, ou é recusado.
      await travarEmpresa(tx, sessao.empresaId);
      const pedido = await tx.solicitacaoVerificacao.findFirst({
        where: { id: parsed.data.solicitacaoId, solicitanteEmpresaId: sessao.empresaId },
        select: { id: true },
      });
      if (!pedido || !(await travarPedidoPendente(tx, pedido.id))) return "sem_pedido" as const;
      const existentes = await tx.arquivo.count({ where: { solicitacaoId: pedido.id, apagadoEm: null } });
      if (existentes >= MAX_DOCUMENTOS_POR_PEDIDO) return "cheio" as const;
      const id = randomUUID();
      await tx.arquivo.create({
        data: {
          id,
          empresaId: sessao.empresaId,
          perfilId: null,
          finalidade: "documento",
          mime: tipo,
          tamanho: conteudo.byteLength,
          dados: new Uint8Array(cifrarDocumento(conteudo, { id, solicitacaoId: pedido.id, mime: tipo })),
          cifrado: true,
          sha256,
          solicitacaoId: pedido.id,
          criadoEm: new Date().toISOString(),
        },
      });
      return id;
    });
    if (resultado === "sem_pedido") return erro("Pedido não encontrado ou já decidido.", 404);
    if (resultado === "cheio") return erro(`Cada pedido aceita até ${MAX_DOCUMENTOS_POR_PEDIDO} documentos.`, 409);
    return { status: 200, corpo: { ok: true, arquivoId: resultado } };
  } catch (e) {
    // Sem o objeto de erro bruto: o do Prisma pode carregar trechos da consulta (inclusive os bytes).
    console.error("[api/documentos] falha ao salvar documento:", e instanceof Error ? e.name : "erro", (e as { code?: string }).code ?? "");
    return erro("Não foi possível salvar agora. Tente de novo.", 500);
  }
}
