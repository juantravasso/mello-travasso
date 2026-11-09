import { NextResponse } from "next/server";
import { receberPostagem } from "@/services/data/server/uploadPostagem.server";

// Casca da rota: toda a lógica (e o acesso ao banco) fica em services/data/server.
export async function POST(request: Request) {
  const resposta = await receberPostagem(request);
  return NextResponse.json(resposta.corpo, { status: resposta.status });
}
