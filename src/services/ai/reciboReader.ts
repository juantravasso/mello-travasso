import type { ResultadoExtracao, SolicitacaoExtracao } from "@/types";

/**
 * Serviço client-side chamado pela UI. Envia a foto para a rota
 * /api/ai/extract-recibo (server-side, onde a chave da IA fica protegida)
 * e devolve o resultado tipado. Nunca chame um provedor de IA diretamente
 * do browser — a API key não pode ser exposta ao cliente.
 *
 * A própria IA decide se o documento é um comprovante simples ou uma nota
 * fiscal (ver tipoDocumento no retorno); o usuário pode corrigir esse
 * palpite na tela de confirmação.
 */
export async function extrairDadosDoComprovante(arquivo: Blob): Promise<ResultadoExtracao> {
  const { base64, mimeType } = await blobParaBase64(arquivo);

  const solicitacao: SolicitacaoExtracao = {
    imagemBase64: base64,
    mimeType,
  };

  try {
    const resposta = await fetch("/api/ai/extract-recibo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(solicitacao),
    });

    const resultado = (await resposta.json()) as ResultadoExtracao;
    return resultado;
  } catch {
    return { sucesso: false, erro: "Não foi possível conectar ao serviço de leitura por IA." };
  }
}

function blobParaBase64(arquivo: Blob): Promise<{ base64: string; mimeType: SolicitacaoExtracao["mimeType"] }> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error("Falha ao ler o arquivo de imagem."));
    leitor.onload = () => {
      const resultado = leitor.result as string; // formato: data:<mime>;base64,<dados>
      const [prefixo, base64] = resultado.split(",");
      const mimeMatch = prefixo?.match(/data:(.*);base64/);
      const mimeType = (mimeMatch?.[1] as SolicitacaoExtracao["mimeType"]) || "image/jpeg";
      if (!base64) {
        reject(new Error("Formato de imagem inesperado."));
        return;
      }
      resolve({ base64, mimeType });
    };
    leitor.readAsDataURL(arquivo);
  });
}
