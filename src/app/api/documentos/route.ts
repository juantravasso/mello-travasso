import { NextResponse } from "next/server";
import { receberDocumento } from "@/services/data/server/uploadDocumento.server";

// Casca da rota: toda a lógica (e o acesso ao banco) fica em services/data/server.
export async function POST(request: Request) {
  const resposta = await receberDocumento(request);
  return NextResponse.json(resposta.corpo, { status: resposta.status, headers: { "Cache-Control": "no-store" } });
}
