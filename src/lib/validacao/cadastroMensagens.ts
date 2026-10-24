import { criarContaSchema } from "./cadastro";

// Apoio da tela de cadastro: valida no navegador com o mesmo esquema do servidor (as mensagens são as mesmas) e monta a
// lista do que está impedindo a criação da conta, na ordem em que os campos aparecem.

export type TipoPessoaCadastro = "pj" | "pf";

const ORDEM_DOS_CAMPOS = ["documento", "razaoSocial", "nomeUsuario", "email", "senha", "aceiteTermos", "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "estado", "telefone"];

export function rotuloDoCampo(campo: string, tipo: TipoPessoaCadastro): string {
  switch (campo) {
    case "documento":
      return tipo === "pj" ? "CNPJ" : "CPF";
    case "razaoSocial":
      return tipo === "pj" ? "Razão social" : "Nome completo";
    case "nomeUsuario":
      return "Seu nome";
    case "email":
      return "E-mail";
    case "senha":
      return "Senha";
    case "aceiteTermos":
      return "Termos de Uso";
    case "cep":
      return "CEP";
    case "logradouro":
      return "Endereço";
    case "numero":
      return "Número";
    case "complemento":
      return "Complemento";
    case "bairro":
      return "Bairro";
    case "cidade":
      return "Cidade";
    case "estado":
      return "UF";
    case "telefone":
      return "Telefone";
    default:
      return campo;
  }
}

export interface ErroDeCampo {
  campo: string;
  rotulo: string;
  mensagem: string;
}

/** Os erros em lista, na ordem da tela, cada um com o nome do campo e o que fazer. */
export function listarErrosDoCadastro(campos: Record<string, string>, tipo: TipoPessoaCadastro): ErroDeCampo[] {
  const posicao = (campo: string) => {
    const i = ORDEM_DOS_CAMPOS.indexOf(campo);
    return i === -1 ? ORDEM_DOS_CAMPOS.length : i;
  };
  return Object.entries(campos)
    .filter(([campo]) => campo !== "form")
    .sort(([a], [b]) => posicao(a) - posicao(b))
    .map(([campo, mensagem]) => ({ campo, rotulo: rotuloDoCampo(campo, tipo), mensagem }));
}

/** Valida o cadastro antes de enviar. Devolve só o primeiro erro de cada campo (vazio = pode enviar). */
export function validarCadastroNoNavegador(entrada: unknown): Record<string, string> {
  const resultado = criarContaSchema.safeParse(entrada);
  if (resultado.success) return {};
  const campos: Record<string, string> = {};
  for (const problema of resultado.error.issues) {
    const campo = String(problema.path[0] ?? "form");
    if (!campos[campo]) campos[campo] = problema.message;
  }
  return campos;
}
