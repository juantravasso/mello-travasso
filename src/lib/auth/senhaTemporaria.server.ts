import "server-only";

// Senha inicial que o dono da empresa entrega a quem ele cadastra. O usuário é obrigado a trocá-la no
// primeiro acesso (flag `trocarSenha`) e ela deixa de valer sozinha depois de alguns dias, para não
// ficar uma conta aberta com uma senha que várias pessoas conhecem.
export const SENHA_TEMPORARIA = "mudar1234";

const DIAS_DE_VALIDADE = 7;

export function fimDaSenhaTemporaria(agora: Date = new Date()): string {
  return new Date(agora.getTime() + DIAS_DE_VALIDADE * 24 * 60 * 60 * 1000).toISOString();
}

export const VALIDADE_SENHA_TEMPORARIA_DIAS = DIAS_DE_VALIDADE;
