import { NextResponse } from "next/server";
import { receberUpload } from "@/services/data/server/uploadPortfolio.server";

// Casca da rota: toda a lógica (e o acesso ao banco) fica em services/data/server.
export async function POST(request: Request) {
  const resposta = await receberUpload(request);
  return NextResponse.json(resposta.corpo, { status: resposta.status });
}
