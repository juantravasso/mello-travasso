import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirRedeAction } from "@/lib/auth/dal";
import { verificarLimite } from "@/lib/auth/limite";
import {
  detectarTipoImagem,
  excluirArquivos,
  MAX_ARQUIVOS_POR_PERFIL,
  sanearImagem,
  salvarArquivo,
  TAMANHO_MAXIMO_BYTES,
  travarPerfil,
} from "./armazenamento.server";

export interface RespostaUpload {
  status: number;
  corpo: { ok: boolean; mensagem?: string; arquivoId?: string; fotoId?: string };
}

// Upload de imagem do portfólio e do logo. Rota de API (não Server Action) para
// controlar o tamanho do corpo antes de ler. A identidade vem da sessão; o
// destino (perfil) é sempre o da empresa logada.

const UPLOADS_POR_DIA = 80;
const MAX_FOTOS_POR_TRABALHO = 8;
const MARGEM_MULTIPART_BYTES = 64 * 1024;
const UM_DIA_MS = 24 * 60 * 60 * 1000;

const campos = z.object({
  tipo: z.enum(["logo", "portfolio"]),
  trabalhoId: z.string().uuid().optional(),
});

function erro(mensagem: string, status: number): RespostaUpload {
  return { status, corpo: { ok: false, mensagem } };
}

/** Lê o corpo contando os bytes e aborta ao passar do teto, sem confiar no Content-Length. */
export async function lerFormularioLimitado(request: Request, maximo: number): Promise<FormData | "grande" | "invalido"> {
  const leitor = request.body?.getReader();
  if (!leitor) return "invalido";
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximo) {
      await leitor.cancel().catch(() => undefined);
      return "grande";
    }
    partes.push(value);
  }
  const tipoConteudo = request.headers.get("content-type") ?? "";
  try {
    return await new Response(Buffer.concat(partes), { headers: { "content-type": tipoConteudo } }).formData();
  } catch {
    return "invalido";
  }
}

export async function receberUpload(request: Request): Promise<RespostaUpload> {
  // Defesa extra contra CSRF (o cookie já é SameSite=Lax): origem ou contexto de outro site, recusa.
  const origem = request.headers.get("origin");
  if (origem && origem !== new URL(request.url).origin) return erro("Origem não permitida.", 403);
  if (request.headers.get("sec-fetch-site") === "cross-site") return erro("Origem não permitida.", 403);

  const tamanhoDeclarado = Number(request.headers.get("content-length"));
  if (!Number.isFinite(tamanhoDeclarado) || tamanhoDeclarado <= 0) return erro("Envie a imagem de novo.", 411);
  const teto = TAMANHO_MAXIMO_BYTES + MARGEM_MULTIPART_BYTES;
  if (tamanhoDeclarado > teto) return erro("A imagem é grande demais.", 413);

  let sessao;
  try {
    sessao = await exigirRedeAction();
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "";
    if (mensagem === "PLANO_SEM_ACESSO") return erro("Seu plano não inclui a rede.", 403);
    if (mensagem === "NAO_AUTENTICADO") return erro("Entre para enviar imagens.", 401);
    throw e;
  }

  const limite = await verificarLimite(`rede-upload:${sessao.empresaId}`, UPLOADS_POR_DIA, UM_DIA_MS);
  if (!limite.permitido) return erro("Muitos envios hoje. Tente de novo amanhã.", 429);

  const formulario = await lerFormularioLimitado(request, teto);
  if (formulario === "grande") return erro("A imagem é grande demais.", 413);
  if (formulario === "invalido") return erro("Envio inválido.", 400);

  const parsed = campos.safeParse({
    tipo: formulario.get("tipo"),
    trabalhoId: formulario.get("trabalhoId") || undefined,
  });
  const arquivo = formulario.get("arquivo");
  if (!parsed.success || !(arquivo instanceof File)) return erro("Envio inválido.", 400);
  if (arquivo.size <= 0 || arquivo.size > TAMANHO_MAXIMO_BYTES) return erro("A imagem é grande demais.", 413);

  const original = new Uint8Array(await arquivo.arrayBuffer());
  const mime = detectarTipoImagem(original);
  if (!mime) return erro("Use uma imagem JPEG, PNG ou WebP.", 415);
  // Remove EXIF/GPS e metadados e valida a estrutura e as dimensões, qualquer que seja o cliente.
  const bytes = sanearImagem(original, mime);
  if (!bytes) return erro("Não foi possível aceitar essa imagem. Use uma foto JPEG, PNG ou WebP comum.", 415);

  const perfil = await prisma.perfilPublico.findUnique({ where: { empresaId: sessao.empresaId }, select: { id: true } });
  if (!perfil) return erro("Crie seu perfil antes de enviar imagens.", 400);

  const { tipo, trabalhoId } = parsed.data;
  const mensagemLimite = "Você atingiu o limite de imagens do perfil. Exclua alguma para enviar outra.";
  try {
    if (tipo === "logo") {
      const id = await prisma.$transaction(async (tx) => {
        await travarPerfil(tx, perfil.id);
        const antigos = await tx.arquivo.findMany({ where: { perfilId: perfil.id, finalidade: "logo" }, select: { id: true } });
        // A troca de logo não conta o logo que está saindo.
        const outros = await tx.arquivo.count({ where: { perfilId: perfil.id, finalidade: { not: "logo" } } });
        if (outros >= MAX_ARQUIVOS_POR_PERFIL) return "limite" as const;
        await excluirArquivos(tx, antigos.map((a) => a.id), sessao.empresaId);
        return salvarArquivo(tx, { empresaId: sessao.empresaId, perfilId: perfil.id, finalidade: "logo", mime, bytes });
      });
      if (id === "limite") return erro(mensagemLimite, 409);
      return { status: 200, corpo: { ok: true, arquivoId: id } };
    }

    if (!trabalhoId) return erro("Escolha o trabalho que recebe a foto.", 400);
    const resultado = await prisma.$transaction(async (tx) => {
      // O lock serializa uploads do mesmo perfil: os limites abaixo valem sob concorrência.
      await travarPerfil(tx, perfil.id);
      if ((await tx.arquivo.count({ where: { perfilId: perfil.id } })) >= MAX_ARQUIVOS_POR_PERFIL) return "limite" as const;
      const trabalho = await tx.trabalho.findFirst({
        where: { id: trabalhoId, perfilId: perfil.id },
        select: { id: true, _count: { select: { fotos: true } } },
      });
      if (!trabalho) return null;
      if (trabalho._count.fotos >= MAX_FOTOS_POR_TRABALHO) return "cheio" as const;
      const ultima = await tx.trabalhoFoto.findFirst({ where: { trabalhoId }, orderBy: { ordem: "desc" }, select: { ordem: true } });
      const arquivoId = await salvarArquivo(tx, { empresaId: sessao.empresaId, perfilId: perfil.id, finalidade: "portfolio", mime, bytes });
      const foto = await tx.trabalhoFoto.create({
        data: { trabalhoId, arquivoId, ordem: (ultima?.ordem ?? -1) + 1, criadoEm: new Date().toISOString() },
        select: { id: true },
      });
      return { arquivoId, fotoId: foto.id };
    });
    if (resultado === null) return erro("Trabalho não encontrado.", 404);
    if (resultado === "limite") return erro(mensagemLimite, 409);
    if (resultado === "cheio") return erro(`Cada trabalho aceita até ${MAX_FOTOS_POR_TRABALHO} fotos.`, 409);
    return { status: 200, corpo: { ok: true, ...resultado } };
  } catch (e) {
    // Sem o objeto de erro bruto: o do Prisma pode carregar trechos da consulta (inclusive os bytes).
    console.error("[api/arquivos] falha ao salvar imagem:", e instanceof Error ? e.name : "erro", (e as { code?: string }).code ?? "");
    return erro("Não foi possível salvar agora. Tente de novo.", 500);
  }
}
