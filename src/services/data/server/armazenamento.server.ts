import "server-only";
import type { FinalidadeArquivoDb, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Interface única de armazenamento de arquivos. Hoje os bytes ficam no Postgres
// (tabela Arquivo); trocar por Blob/S3 significa reescrever só este módulo.

export const TAMANHO_MAXIMO_BYTES = 900 * 1024;
export const MAX_ARQUIVOS_POR_PERFIL = 60;

const MAX_LADO_PX = 8000;
const MAX_PIXELS = 16_000_000;

export type TipoImagem = "image/jpeg" | "image/png" | "image/webp";
type Bytes = Uint8Array<ArrayBuffer>;

/**
 * Descobre o tipo pelos primeiros bytes, ignorando o que o cliente declarou
 * (Content-Type e extensão são forjáveis). Só JPEG, PNG e WebP: nada de SVG ou
 * HTML, que poderiam executar script quando abertos direto na URL.
 */
export function detectarTipoImagem(bytes: Uint8Array): TipoImagem | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function juntar(partes: Uint8Array[]): Bytes {
  const total = partes.reduce((soma, p) => soma + p.length, 0);
  const saida = new Uint8Array(total);
  let posicao = 0;
  for (const p of partes) {
    saida.set(p, posicao);
    posicao += p.length;
  }
  return saida;
}

function dimensoesValidas(largura: number, altura: number): boolean {
  return (
    largura > 0 && altura > 0 && largura <= MAX_LADO_PX && altura <= MAX_LADO_PX && largura * altura <= MAX_PIXELS
  );
}

// --- JPEG -------------------------------------------------------------------
// Mantém só o que a imagem precisa para ser exibida: APP0 (JFIF), APP2 (perfil
// ICC), APP14 (Adobe), tabelas e a imagem. Descarta Exif/XMP (APP1), IPTC e os
// demais APPn, e comentários (COM): é aí que ficam GPS, data e modelo do aparelho.

const SOF_JPEG = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function sanearJpeg(b: Uint8Array): { bytes: Bytes; largura: number; altura: number } | null {
  const saida: Uint8Array[] = [b.slice(0, 2)];
  let i = 2;
  let largura = 0;
  let altura = 0;
  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    while (b[i] === 0xff && i + 1 < b.length && b[i + 1] === 0xff) i++;
    const marcador = b[i + 1];
    if (marcador === undefined) return null;

    if (marcador === 0xd9) return null; // EOI antes da imagem
    if (marcador === 0xda) {
      // Início dos dados da imagem: copia até o último EOI (descarta lixo depois dele).
      let fim = -1;
      for (let j = b.length - 2; j > i; j--) {
        if (b[j] === 0xff && b[j + 1] === 0xd9) {
          fim = j + 2;
          break;
        }
      }
      if (fim < 0 || largura === 0) return null;
      saida.push(b.slice(i, fim));
      return { bytes: juntar(saida), largura, altura };
    }
    if (marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd7)) {
      saida.push(b.slice(i, i + 2));
      i += 2;
      continue;
    }
    if (i + 3 >= b.length) return null;
    const tamanho = (b[i + 2]! << 8) | b[i + 3]!;
    const fimSegmento = i + 2 + tamanho;
    if (tamanho < 2 || fimSegmento > b.length) return null;

    if (SOF_JPEG.has(marcador)) {
      if (tamanho < 8) return null;
      altura = (b[i + 5]! << 8) | b[i + 6]!;
      largura = (b[i + 7]! << 8) | b[i + 8]!;
      if (!dimensoesValidas(largura, altura)) return null;
    }
    const ehAppDescartavel = marcador >= 0xe1 && marcador <= 0xef && marcador !== 0xe2 && marcador !== 0xee;
    if (!ehAppDescartavel && marcador !== 0xfe) saida.push(b.slice(i, fimSegmento));
    i = fimSegmento;
  }
  return null;
}

// --- PNG --------------------------------------------------------------------
// Mantém IHDR, PLTE, IDAT, IEND e os auxiliares pequenos de cor (tRNS, gAMA,
// cHRM, sRGB). Descarta eXIf e todo texto (tEXt/zTXt/iTXt) e demais metadados.

const CHUNKS_PNG_MANTIDOS = new Set(["IHDR", "PLTE", "IDAT", "IEND", "tRNS", "gAMA", "cHRM", "sRGB"]);

function sanearPng(b: Uint8Array): { bytes: Bytes; largura: number; altura: number } | null {
  const saida: Uint8Array[] = [b.slice(0, 8)];
  let i = 8;
  let largura = 0;
  let altura = 0;
  let primeiro = true;
  while (i + 12 <= b.length) {
    const tamanho = ((b[i]! << 24) | (b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!) >>> 0;
    const tipo = String.fromCharCode(b[i + 4]!, b[i + 5]!, b[i + 6]!, b[i + 7]!);
    const fim = i + 12 + tamanho;
    if (fim > b.length) return null;

    if (primeiro) {
      if (tipo !== "IHDR" || tamanho !== 13) return null;
      largura = ((b[i + 8]! << 24) | (b[i + 9]! << 16) | (b[i + 10]! << 8) | b[i + 11]!) >>> 0;
      altura = ((b[i + 12]! << 24) | (b[i + 13]! << 16) | (b[i + 14]! << 8) | b[i + 15]!) >>> 0;
      if (!dimensoesValidas(largura, altura)) return null;
      primeiro = false;
    }
    if (CHUNKS_PNG_MANTIDOS.has(tipo)) saida.push(b.slice(i, fim));
    i = fim;
    if (tipo === "IEND") return { bytes: juntar(saida), largura, altura };
  }
  return null;
}

// --- WebP -------------------------------------------------------------------
// Descarta os chunks EXIF e XMP e apaga as flags correspondentes do VP8X.

function lerU24(b: Uint8Array, p: number): number {
  return b[p]! | (b[p + 1]! << 8) | (b[p + 2]! << 16);
}

function sanearWebp(b: Uint8Array): { bytes: Bytes; largura: number; altura: number } | null {
  const tamanhoRiff = (b[4]! | (b[5]! << 8) | (b[6]! << 16) | (b[7]! << 24)) >>> 0;
  if (tamanhoRiff + 8 > b.length || tamanhoRiff < 4) return null;
  const limite = tamanhoRiff + 8;
  const chunks: Uint8Array[] = [];
  let largura = 0;
  let altura = 0;
  let i = 12;
  while (i + 8 <= limite) {
    const tipo = String.fromCharCode(b[i]!, b[i + 1]!, b[i + 2]!, b[i + 3]!);
    const tamanho = (b[i + 4]! | (b[i + 5]! << 8) | (b[i + 6]! << 16) | (b[i + 7]! << 24)) >>> 0;
    const dados = i + 8;
    const fimDados = dados + tamanho;
    const fimChunk = fimDados + (tamanho % 2);
    if (fimChunk > limite) return null;

    if (tipo === "VP8X" && tamanho >= 10) {
      largura = lerU24(b, dados + 4) + 1;
      altura = lerU24(b, dados + 7) + 1;
    } else if (tipo === "VP8 " && tamanho >= 10 && largura === 0) {
      largura = (b[dados + 6]! | (b[dados + 7]! << 8)) & 0x3fff;
      altura = (b[dados + 8]! | (b[dados + 9]! << 8)) & 0x3fff;
    } else if (tipo === "VP8L" && tamanho >= 5 && b[dados] === 0x2f && largura === 0) {
      const bits = b[dados + 1]! | (b[dados + 2]! << 8) | (b[dados + 3]! << 16) | (b[dados + 4]! << 24);
      largura = (bits & 0x3fff) + 1;
      altura = ((bits >>> 14) & 0x3fff) + 1;
    }

    if (tipo !== "EXIF" && tipo !== "XMP ") {
      const copia = b.slice(i, fimChunk);
      // No VP8X, apaga as flags de Exif (0x08) e XMP (0x04).
      if (tipo === "VP8X" && tamanho >= 10) copia[8] = copia[8]! & ~0x0c;
      chunks.push(copia);
    }
    i = fimChunk;
  }
  if (!dimensoesValidas(largura, altura)) return null;

  const corpo = juntar(chunks);
  const cabecalho = new Uint8Array(12);
  cabecalho.set(b.slice(0, 4), 0);
  const novoTamanho = corpo.length + 4;
  cabecalho[4] = novoTamanho & 0xff;
  cabecalho[5] = (novoTamanho >>> 8) & 0xff;
  cabecalho[6] = (novoTamanho >>> 16) & 0xff;
  cabecalho[7] = (novoTamanho >>> 24) & 0xff;
  cabecalho.set(b.slice(8, 12), 8);
  return { bytes: juntar([cabecalho, corpo]), largura, altura };
}

/**
 * Sanea uma imagem no servidor, qualquer que seja o caminho do envio (a
 * reencodificação do navegador não vale para quem chama a API direto): remove
 * EXIF/GPS/XMP/comentários, corta lixo anexado depois do fim da imagem e recusa
 * arquivo malformado ou com dimensões absurdas (bomba de descompressão).
 * Devolve null quando a imagem não passa.
 */
export function sanearImagem(bytes: Uint8Array, mime: TipoImagem, maximo: number = TAMANHO_MAXIMO_BYTES): Bytes | null {
  const resultado = mime === "image/jpeg" ? sanearJpeg(bytes) : mime === "image/png" ? sanearPng(bytes) : sanearWebp(bytes);
  if (!resultado || resultado.bytes.length === 0 || resultado.bytes.length > maximo) return null;
  return resultado.bytes;
}

/** Trava a linha do perfil até o fim da transação: serializa uploads/criações concorrentes do mesmo perfil. */
export async function travarPerfil(tx: Prisma.TransactionClient, perfilId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "PerfilPublico" WHERE id = ${perfilId} FOR UPDATE`;
}

export async function salvarArquivo(
  tx: Prisma.TransactionClient | typeof prisma,
  dados: {
    empresaId: string;
    perfilId: string;
    finalidade: FinalidadeArquivoDb;
    mime: TipoImagem;
    bytes: Bytes;
  },
): Promise<string> {
  const criado = await tx.arquivo.create({
    data: {
      empresaId: dados.empresaId,
      perfilId: dados.perfilId,
      finalidade: dados.finalidade,
      mime: dados.mime,
      tamanho: dados.bytes.byteLength,
      dados: dados.bytes,
      criadoEm: new Date().toISOString(),
    },
    select: { id: true },
  });
  return criado.id;
}

export interface MetaArquivo {
  mime: string;
  tamanho: number;
  empresaId: string;
  finalidade: FinalidadeArquivoDb;
  perfil: { status: string } | null;
}

/** Só metadados (sem os bytes): suficiente para decidir se o acesso é permitido. */
export async function lerMetaArquivo(id: string): Promise<MetaArquivo | null> {
  return prisma.arquivo.findUnique({
    where: { id },
    select: { mime: true, tamanho: true, empresaId: true, finalidade: true, perfil: { select: { status: true } } },
  });
}

export async function lerBytesArquivo(id: string): Promise<Uint8Array | null> {
  // Documento de verificação nunca sai por aqui: quem precisa dele usa documentoAcesso (só admin, com log).
  const arquivo = await prisma.arquivo.findFirst({ where: { id, finalidade: { not: "documento" } }, select: { dados: true } });
  return arquivo?.dados ?? null;
}

/** Apaga arquivos da empresa. O escopo por empresa fica aqui, não só em quem chama. */
export async function excluirArquivos(tx: Prisma.TransactionClient, ids: string[], empresaId: string): Promise<void> {
  if (ids.length === 0) return;
  await tx.arquivo.deleteMany({ where: { id: { in: ids }, empresaId } });
}
