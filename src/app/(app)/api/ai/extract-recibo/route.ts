import { NextResponse } from "next/server";
import type { ResultadoExtracao, SolicitacaoExtracao } from "@/types";
import { obterProvedorExtracaoIA } from "@/services/ai/provedor.server";
import { exigirEscritaAction } from "@/lib/auth/dal";
import { verificarLimite } from "@/lib/auth/limite";

export const runtime = "nodejs";

// RF-22: sessão + MIME + tamanho + limite por empresa. 8 MB é o limite do
// arquivo original; base64 infla ~33%, então o corpo JSON pode chegar a ~11 MB.
const MIME_ACEITOS = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const TAMANHO_MAX_ARQUIVO_BYTES = 8 * 1024 * 1024;
const TAMANHO_MAX_CORPO_BYTES = 11 * 1024 * 1024;
const LIMITE_POR_HORA = 30;

function corpoValido(corpo: unknown): corpo is SolicitacaoExtracao {
  if (!corpo || typeof corpo !== "object") return false;
  const c = corpo as Record<string, unknown>;
  return typeof c.imagemBase64 === "string" && typeof c.mimeType === "string";
}

function tamanhoBase64EmBytes(base64: string): number {
  // Cálculo exato do tamanho decodificado, sem alocar o buffer inteiro:
  // cada grupo de 4 chars vira 3 bytes, descontando o padding "=".
  const semPrefixo = base64.includes(",") ? base64.slice(base64.indexOf(",") + 1) : base64;
  const padding = semPrefixo.endsWith("==") ? 2 : semPrefixo.endsWith("=") ? 1 : 0;
  return Math.floor((semPrefixo.length * 3) / 4) - padding;
}

/**
 * Lê o corpo como stream, cortando fisicamente ao ultrapassar o limite —
 * ao contrário de checar só o header `Content-Length` (que um client pode
 * omitir ou mentir, inclusive com `Transfer-Encoding: chunked`), isso vale
 * mesmo se o header estiver ausente ou errado. Retorna null se estourar.
 */
async function lerCorpoComLimite(request: Request, limiteBytes: number): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return "";

  const pedacos: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limiteBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    pedacos.push(value);
  }

  return Buffer.concat(pedacos.map((p) => Buffer.from(p))).toString("utf-8");
}

export async function POST(request: Request): Promise<NextResponse<ResultadoExtracao>> {
  let sessao;
  try {
    sessao = await exigirEscritaAction();
  } catch (erro) {
    if (erro instanceof Error && erro.message === "SOMENTE_LEITURA") {
      return NextResponse.json(
        { sucesso: false, erro: "Teste encerrado — os dados continuam disponíveis para consulta." },
        { status: 403 },
      );
    }
    return NextResponse.json({ sucesso: false, erro: "Não autenticado." }, { status: 401 });
  }

  const limite = await verificarLimite(`ia-extract:${sessao.empresaId}`, LIMITE_POR_HORA, 60 * 60 * 1000);
  if (!limite.permitido) {
    return NextResponse.json(
      { sucesso: false, erro: "Limite de leituras por hora atingido. Tente de novo mais tarde." },
      { status: 429 },
    );
  }

  const texto = await lerCorpoComLimite(request, TAMANHO_MAX_CORPO_BYTES);
  if (texto === null) {
    return NextResponse.json({ sucesso: false, erro: "Arquivo muito grande (máximo 8 MB)." }, { status: 413 });
  }

  let corpo: unknown;
  try {
    corpo = JSON.parse(texto);
  } catch {
    return NextResponse.json({ sucesso: false, erro: "Requisição inválida: corpo não é um JSON válido." }, { status: 400 });
  }

  if (!corpoValido(corpo)) {
    return NextResponse.json(
      { sucesso: false, erro: "Requisição inválida: imagemBase64 e mimeType são obrigatórios." },
      { status: 400 },
    );
  }

  if (!MIME_ACEITOS.has(corpo.mimeType)) {
    return NextResponse.json(
      { sucesso: false, erro: "Tipo de arquivo não aceito. Envie JPEG, PNG, WEBP ou PDF." },
      { status: 415 },
    );
  }

  if (tamanhoBase64EmBytes(corpo.imagemBase64) > TAMANHO_MAX_ARQUIVO_BYTES) {
    return NextResponse.json({ sucesso: false, erro: "Arquivo muito grande (máximo 8 MB)." }, { status: 413 });
  }

  const provedor = obterProvedorExtracaoIA();
  const resultado = await provedor.extrair(corpo);

  return NextResponse.json(resultado, { status: resultado.sucesso ? 200 : 502 });
}
