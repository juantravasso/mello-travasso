import { NextResponse } from "next/server";
import type { ResultadoExtracao, SolicitacaoExtracao } from "@/types";
import { obterProvedorExtracaoIA } from "@/services/ai/provedor.server";

export const runtime = "nodejs";

function corpoValido(corpo: unknown): corpo is SolicitacaoExtracao {
  if (!corpo || typeof corpo !== "object") return false;
  const c = corpo as Record<string, unknown>;
  return typeof c.imagemBase64 === "string" && typeof c.mimeType === "string";
}

export async function POST(request: Request): Promise<NextResponse<ResultadoExtracao>> {
  const corpo: unknown = await request.json();

  if (!corpoValido(corpo)) {
    return NextResponse.json(
      { sucesso: false, erro: "Requisição inválida: imagemBase64 e mimeType são obrigatórios." },
      { status: 400 },
    );
  }

  const provedor = obterProvedorExtracaoIA();
  const resultado = await provedor.extrair(corpo);

  return NextResponse.json(resultado, { status: resultado.sucesso ? 200 : 502 });
}
