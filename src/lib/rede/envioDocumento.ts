// Envio de documento de verificação pelo navegador. Os limites daqui só poupam uma
// ida ao servidor: quem decide (tamanho, tipo pelos bytes, quantidade) é a rota.

export const TIPOS_DOCUMENTO_ACEITOS = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";
export const TAMANHO_MAXIMO_DOCUMENTO_MB = 4;
export const MAX_DOCUMENTOS_POR_PEDIDO = 3;

export type ResultadoEnvio = { ok: true } | { ok: false; mensagem: string };

/** Mensagem para um arquivo que já sabemos que será recusado, ou null se parece válido. */
export function problemaDoArquivo(arquivo: File): string | null {
  if (arquivo.size <= 0) return `"${arquivo.name}" está vazio.`;
  if (arquivo.size > TAMANHO_MAXIMO_DOCUMENTO_MB * 1024 * 1024) return `"${arquivo.name}" passa de ${TAMANHO_MAXIMO_DOCUMENTO_MB} MB.`;
  return null;
}

export async function enviarDocumento(solicitacaoId: string, arquivo: File): Promise<ResultadoEnvio> {
  const corpo = new FormData();
  corpo.set("solicitacaoId", solicitacaoId);
  corpo.set("arquivo", arquivo);
  try {
    const resposta = await fetch("/api/documentos", { method: "POST", body: corpo });
    const dados = (await resposta.json().catch(() => null)) as { ok?: boolean; mensagem?: string } | null;
    if (resposta.ok && dados?.ok) return { ok: true };
    return { ok: false, mensagem: dados?.mensagem ?? "Não foi possível enviar agora. Tente de novo." };
  } catch {
    return { ok: false, mensagem: "Não foi possível enviar agora. Tente de novo." };
  }
}
