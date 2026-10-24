/**
 * Consultas a APIs públicas (sem chave) usadas para preencher o cadastro de
 * fornecedor automaticamente: ViaCEP para endereço a partir do CEP, BrasilAPI
 * para dados da empresa a partir do CNPJ. Chamadas direto do client — ambas
 * suportam CORS e não exigem proteger nenhuma credencial. Qualquer falha
 * (CEP/CNPJ inexistente, rede fora) devolve null em vez de lançar, para não
 * travar o preenchimento manual do formulário.
 */

export interface EnderecoPorCep {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  estado: string;
}

export async function buscarEnderecoPorCep(cep: string): Promise<EnderecoPorCep | null> {
  const digitos = cep.replace(/\D/g, "");
  if (digitos.length !== 8) return null;
  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
    if (!resposta.ok) return null;
    const dados = (await resposta.json()) as Record<string, unknown>;
    if (dados.erro) return null;
    return {
      cep: digitos,
      logradouro: typeof dados.logradouro === "string" ? dados.logradouro : "",
      bairro: typeof dados.bairro === "string" ? dados.bairro : "",
      cidade: typeof dados.localidade === "string" ? dados.localidade : "",
      estado: typeof dados.uf === "string" ? dados.uf : "",
    };
  } catch {
    return null;
  }
}

/** Resultado da consulta de CEP, com a diferença entre "não existe" e "não consegui consultar" para a mensagem certa. */
export type ResultadoCep = { estado: "ok"; endereco: EnderecoPorCep } | { estado: "nao_encontrado" } | { estado: "falha" };

/** Como buscarEnderecoPorCep, mas com timeout de 5 s e dizendo por que não veio endereço. */
export async function consultarCep(cep: string): Promise<ResultadoCep> {
  const digitos = cep.replace(/\D/g, "");
  if (digitos.length !== 8) return { estado: "nao_encontrado" };
  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), 5000);
  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`, { signal: controlador.signal });
    if (!resposta.ok) return { estado: resposta.status === 400 ? "nao_encontrado" : "falha" };
    const dados = (await resposta.json()) as Record<string, unknown>;
    if (dados.erro) return { estado: "nao_encontrado" };
    return {
      estado: "ok",
      endereco: {
        cep: digitos,
        logradouro: typeof dados.logradouro === "string" ? dados.logradouro : "",
        bairro: typeof dados.bairro === "string" ? dados.bairro : "",
        cidade: typeof dados.localidade === "string" ? dados.localidade : "",
        estado: typeof dados.uf === "string" ? dados.uf : "",
      },
    };
  } catch {
    return { estado: "falha" };
  } finally {
    clearTimeout(timeout);
  }
}

export interface EmpresaPorCnpj {
  nome: string;
  /** Razão social e nome fantasia separados — usados no cadastro de conta (/criar-conta). */
  razaoSocial?: string;
  nomeFantasia?: string;
  /** Ex.: "ATIVA", "BAIXADA" — ver RF-03. */
  situacaoCadastral?: string;
  telefone?: string;
  email?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
}

function textoOuUndefined(valor: unknown): string | undefined {
  return typeof valor === "string" && valor.trim() !== "" ? valor : undefined;
}

export async function buscarEmpresaPorCnpj(cnpj: string): Promise<EmpresaPorCnpj | null> {
  const digitos = cnpj.replace(/\D/g, "");
  if (digitos.length !== 14) return null;
  // RF-01: timeout de 5s — sem isso, uma BrasilAPI lenta prende o formulário
  // no estado "consultando" em vez de cair no preenchimento manual (RF-02).
  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), 5000);
  try {
    const resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digitos}`, { signal: controlador.signal });
    if (!resposta.ok) return null;
    const dados = (await resposta.json()) as Record<string, unknown>;
    const razaoSocial = textoOuUndefined(dados.razao_social);
    const nomeFantasia = textoOuUndefined(dados.nome_fantasia);
    const nome = nomeFantasia ?? razaoSocial;
    if (!nome) return null;
    return {
      nome,
      razaoSocial,
      nomeFantasia,
      situacaoCadastral: textoOuUndefined(dados.descricao_situacao_cadastral),
      telefone: textoOuUndefined(dados.ddd_telefone_1),
      email: textoOuUndefined(dados.email),
      cep: textoOuUndefined(dados.cep),
      logradouro: textoOuUndefined(dados.logradouro),
      numero: textoOuUndefined(dados.numero),
      complemento: textoOuUndefined(dados.complemento),
      bairro: textoOuUndefined(dados.bairro),
      cidade: textoOuUndefined(dados.municipio),
      estado: textoOuUndefined(dados.uf),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
