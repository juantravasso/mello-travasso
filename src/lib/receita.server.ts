import "server-only";

// Consulta server-side ao cadastro público de CNPJ (BrasilAPI), só para dar à
// administração o dado oficial ao lado do que a empresa declarou ao se cadastrar.
// Host fixo, só dígitos no caminho, timeout curto e cache em memória: uma falha
// ou lentidão do serviço nunca trava a fila (a tela mostra "indisponível").

export interface DadosReceita {
  razaoSocial: string;
  situacao: string;
  /** Situação cadastral ATIVA. */
  ativa: boolean;
  /** Nomes do quadro societário (a Receita já mascara os CPFs). */
  socios: string[];
  municipio?: string;
  uf?: string;
}

const TEMPO_LIMITE_MS = 4000;
const VALIDADE_CACHE_MS = 10 * 60 * 1000;
const MAX_ENTRADAS_CACHE = 200;
const cache = new Map<string, { em: number; dados: DadosReceita | null }>();

function texto(valor: unknown): string | undefined {
  return typeof valor === "string" && valor.trim() !== "" ? valor.trim() : undefined;
}

/** null quando o serviço não responde, o CNPJ não existe ou a resposta é inesperada. */
export async function consultarReceita(cnpj: string): Promise<DadosReceita | null> {
  if (!/^\d{14}$/.test(cnpj)) return null;
  const guardado = cache.get(cnpj);
  if (guardado && Date.now() - guardado.em < VALIDADE_CACHE_MS) return guardado.dados;

  let dados: DadosReceita | null = null;
  try {
    const resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { signal: AbortSignal.timeout(TEMPO_LIMITE_MS) });
    if (resposta.ok) {
      const json = (await resposta.json()) as Record<string, unknown>;
      const razaoSocial = texto(json.razao_social);
      const situacao = texto(json.descricao_situacao_cadastral);
      if (razaoSocial && situacao) {
        const qsa = Array.isArray(json.qsa) ? json.qsa : [];
        dados = {
          razaoSocial,
          situacao,
          ativa: situacao.toUpperCase() === "ATIVA",
          socios: qsa
            .map((s) => texto((s as Record<string, unknown>)?.nome_socio))
            .filter((n): n is string => n !== undefined)
            .slice(0, 20),
          municipio: texto(json.municipio),
          uf: texto(json.uf),
        };
      }
    }
  } catch {
    dados = null;
  }
  if (cache.size >= MAX_ENTRADAS_CACHE) cache.clear();
  // Falha também entra no cache, por pouco tempo equivalente: evita martelar um serviço fora do ar.
  cache.set(cnpj, { em: Date.now(), dados });
  return dados;
}
