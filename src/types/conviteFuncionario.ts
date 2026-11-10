/** Dados que o próprio funcionário preenche pelo link. Salário e projeto ficam por conta do dono, na aprovação. */
export interface DadosCadastroFuncionario {
  nome: string;
  cargo: string;
  telefone?: string;
  email?: string;
  cpf?: string;
}

export type SituacaoConviteFuncionario = "aguardando_preenchimento" | "aguardando_aprovacao" | "expirado";

export interface ConviteFuncionarioItem {
  id: string;
  situacao: SituacaoConviteFuncionario;
  nomeSugerido?: string;
  cargoSugerido?: string;
  criadoEm: string;
  expiraEm: string;
  preenchidoEm?: string;
  /** Só quando a pessoa já preencheu: o que o dono vai revisar. */
  dados?: DadosCadastroFuncionario;
}

export interface ConviteFuncionarioCriado {
  id: string;
  /** O link completo. Só aparece agora: depois só existe o hash, então para outro link é preciso gerar um novo convite. */
  link: string;
  expiraEm: string;
}

/** O que a página pública do link mostra. Convite inexistente, usado, vencido ou cancelado têm a mesma resposta. */
export type ConvitePublicoFuncionario =
  | { valido: true; empresa: string; nomeSugerido?: string; cargoSugerido?: string }
  | { valido: false };
