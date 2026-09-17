export function blobParaDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error("Falha ao processar a imagem."));
    leitor.onload = () => resolve(leitor.result as string);
    leitor.readAsDataURL(blob);
  });
}
