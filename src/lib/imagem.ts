export function blobParaDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error("Falha ao processar a imagem."));
    leitor.onload = () => resolve(leitor.result as string);
    leitor.readAsDataURL(blob);
  });
}

/**
 * Reduz uma imagem no navegador antes do envio: lado maior até `maxLado` px e
 * JPEG com qualidade decrescente até caber em `maxBytes`. Evita mandar fotos de
 * câmera de vários MB (o servidor também limita o tamanho).
 */
export async function reduzirImagem(arquivo: File, maxLado = 1600, maxBytes = 800 * 1024): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo).catch(() => {
    throw new Error("Não foi possível ler essa imagem. Use JPEG, PNG ou WebP.");
  });
  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
  const largura = Math.max(1, Math.round(bitmap.width * escala));
  const altura = Math.max(1, Math.round(bitmap.height * escala));

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const contexto = canvas.getContext("2d");
  if (!contexto) throw new Error("Não foi possível processar a imagem.");
  contexto.fillStyle = "#ffffff";
  contexto.fillRect(0, 0, largura, altura);
  contexto.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();

  for (const qualidade of [0.85, 0.72, 0.6, 0.45]) {
    const blob = await new Promise<Blob | null>((resolver) => canvas.toBlob(resolver, "image/jpeg", qualidade));
    if (blob && blob.size <= maxBytes) return blob;
  }
  throw new Error("A imagem continua grande demais. Tente uma foto menor.");
}

export interface ResultadoEnvioImagem {
  ok: boolean;
  mensagem?: string;
}

/** Envia a imagem já reduzida para a rota de upload do portfólio/logo. */
export async function enviarImagem(blob: Blob, destino: { tipo: "logo" } | { tipo: "portfolio"; trabalhoId: string }): Promise<ResultadoEnvioImagem> {
  const formulario = new FormData();
  formulario.set("tipo", destino.tipo);
  if (destino.tipo === "portfolio") formulario.set("trabalhoId", destino.trabalhoId);
  formulario.set("arquivo", blob, "imagem.jpg");
  try {
    const resposta = await fetch("/api/arquivos", { method: "POST", body: formulario });
    const dados = (await resposta.json().catch(() => null)) as ResultadoEnvioImagem | null;
    if (resposta.ok && dados?.ok) return { ok: true };
    return { ok: false, mensagem: dados?.mensagem ?? "Não foi possível enviar a imagem." };
  } catch {
    return { ok: false, mensagem: "Sem conexão. Tente de novo." };
  }
}
