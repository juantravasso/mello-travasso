import { ImageResponse } from "next/og";
import { SimboloImagem, SimboloMascaravel } from "@/lib/marcaImagem";

// Ícones do app para o manifesto (/manifest.webmanifest). O Chrome no Android só oferece "Instalar app" quando o
// manifesto traz PNG de 192 e 512 px; a versão "maskable" evita que o Android corte o desenho ao recortar o ícone.
// Rota pública (ver o matcher do proxy): o navegador busca os ícones sem sessão.

const TAMANHOS = {
  "192": { lado: 192, mascaravel: false },
  "512": { lado: 512, mascaravel: false },
  "512-maskable": { lado: 512, mascaravel: true },
} as const;

type ChaveTamanho = keyof typeof TAMANHOS;

const ehTamanho = (valor: string): valor is ChaveTamanho => Object.hasOwn(TAMANHOS, valor);

export async function GET(_request: Request, contexto: { params: Promise<{ tamanho: string }> }): Promise<Response> {
  const { tamanho } = await contexto.params;
  if (!ehTamanho(tamanho)) return new Response("Não encontrado.", { status: 404 });
  const { lado, mascaravel } = TAMANHOS[tamanho];
  return new ImageResponse(mascaravel ? <SimboloMascaravel lado={lado} /> : <SimboloImagem lado={lado} />, { width: lado, height: lado });
}
