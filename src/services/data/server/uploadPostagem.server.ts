import "server-only";
import { prisma } from "@/lib/prisma";
import { exigirRedeAction } from "@/lib/auth/dal";
import { verificarLimite } from "@/lib/auth/limite";
import { MAX_FOTOS_POSTAGEM, POSTAGENS_POR_DIA } from "@/lib/feed";
import { textoPostagemSchema } from "@/lib/validacao/feed";
import { detectarTipoImagem, sanearImagem, salvarArquivo, TAMANHO_MAXIMO_BYTES } from "./armazenamento.server";
import { exigirParticipante } from "./feedCore.server";
import { ErroDeNegocio } from "./resultado.server";
import { lerFormularioLimitado, type RespostaUpload } from "./uploadPortfolio.server";

// Criação de uma postagem (texto + até 4 fotos) numa única requisição multipart: o texto e as fotos entram juntos ou
// nenhum entra, sem foto órfã no banco. Rota de API (não Server Action) para limitar o corpo antes de ler. A identidade
// vem da sessão; o perfil que assina é sempre o da empresa logada.

const MARGEM_MULTIPART_BYTES = 128 * 1024;
const UM_DIA_MS = 24 * 60 * 60 * 1000;

function erro(mensagem: string, status: number): RespostaUpload {
  return { status, corpo: { ok: false, mensagem } };
}

export async function receberPostagem(request: Request): Promise<RespostaUpload> {
  // Defesa extra contra CSRF (o cookie já é SameSite=Lax).
  const origem = request.headers.get("origin");
  if (origem && origem !== new URL(request.url).origin) return erro("Origem não permitida.", 403);
  if (request.headers.get("sec-fetch-site") === "cross-site") return erro("Origem não permitida.", 403);

  const declarado = Number(request.headers.get("content-length"));
  if (!Number.isFinite(declarado) || declarado <= 0) return erro("Envie a postagem de novo.", 411);
  const teto = TAMANHO_MAXIMO_BYTES * MAX_FOTOS_POSTAGEM + MARGEM_MULTIPART_BYTES;
  if (declarado > teto) return erro("As fotos são grandes demais.", 413);

  let sessao;
  try {
    sessao = await exigirRedeAction();
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "";
    if (mensagem === "PLANO_SEM_ACESSO" || mensagem === "SEM_ACESSO_MODULO") return erro("Seu acesso não inclui o Elo Profissionais.", 403);
    if (mensagem === "NAO_AUTENTICADO") return erro("Entre para publicar.", 401);
    throw e;
  }

  let perfilId: string;
  try {
    ({ perfilId } = await exigirParticipante(sessao));
  } catch (e) {
    if (e instanceof ErroDeNegocio) return erro(e.message, 403);
    throw e;
  }

  const limite = await verificarLimite(`feed-postar:${sessao.empresaId}`, POSTAGENS_POR_DIA, UM_DIA_MS);
  if (!limite.permitido) return erro("Você já fez muitas postagens hoje. Tente de novo amanhã.", 429);

  const formulario = await lerFormularioLimitado(request, teto);
  if (formulario === "grande") return erro("As fotos são grandes demais.", 413);
  if (formulario === "invalido") return erro("Envio inválido.", 400);

  const textoBruto = formulario.get("texto");
  const texto = textoPostagemSchema.safeParse(typeof textoBruto === "string" ? textoBruto : "");
  if (!texto.success) return erro(texto.error.issues[0]?.message ?? "Texto inválido.", 400);

  const arquivos = formulario.getAll("arquivo").filter((x): x is File => x instanceof File);
  if (arquivos.length > MAX_FOTOS_POSTAGEM) return erro(`Cada postagem aceita até ${MAX_FOTOS_POSTAGEM} fotos.`, 400);
  if (texto.data.length === 0 && arquivos.length === 0) return erro("Escreva algo ou escolha uma foto.", 400);

  const imagens: { mime: NonNullable<ReturnType<typeof detectarTipoImagem>>; bytes: NonNullable<ReturnType<typeof sanearImagem>> }[] = [];
  for (const arquivo of arquivos) {
    if (arquivo.size <= 0 || arquivo.size > TAMANHO_MAXIMO_BYTES) return erro("Uma das fotos é grande demais.", 413);
    const original = new Uint8Array(await arquivo.arrayBuffer());
    const mime = detectarTipoImagem(original);
    if (!mime) return erro("Use fotos JPEG, PNG ou WebP.", 415);
    // Remove EXIF/GPS e metadados e valida a estrutura, qualquer que seja o cliente.
    const bytes = sanearImagem(original, mime);
    if (!bytes) return erro("Não foi possível aceitar uma das fotos. Use uma foto JPEG, PNG ou WebP comum.", 415);
    imagens.push({ mime, bytes });
  }

  try {
    const agora = new Date().toISOString();
    const id = await prisma.$transaction(async (tx) => {
      const post = await tx.postagem.create({
        data: { perfilId, empresaId: sessao.empresaId, usuarioId: sessao.usuarioId, texto: texto.data, criadoEm: agora, atualizadoEm: agora },
        select: { id: true },
      });
      for (const [ordem, imagem] of imagens.entries()) {
        const arquivoId = await salvarArquivo(tx, { empresaId: sessao.empresaId, perfilId, finalidade: "postagem", mime: imagem.mime, bytes: imagem.bytes });
        await tx.postagemFoto.create({ data: { postagemId: post.id, arquivoId, ordem, criadoEm: agora } });
      }
      return post.id;
    });
    return { status: 200, corpo: { ok: true, fotoId: id } };
  } catch (e) {
    // Sem o objeto de erro bruto: o do Prisma pode carregar trechos da consulta (inclusive os bytes).
    console.error("[api/postagens] falha ao salvar postagem:", e instanceof Error ? e.name : "erro", (e as { code?: string }).code ?? "");
    return erro("Não foi possível publicar agora. Tente de novo.", 500);
  }
}
