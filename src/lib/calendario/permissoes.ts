// Quem pode o quê em um compromisso. Só o criador altera; participantes apenas enxergam. A empresa NÃO dá
// acesso: nem o dono vê o calendário pessoal dos outros usuários.

export interface CompromissoAcesso {
  empresaId: string;
  criadoPorId: string;
  participantesIds: readonly string[];
}

export interface Pessoa {
  usuarioId: string;
  empresaId: string;
}

export function ehCriador(c: CompromissoAcesso, p: Pessoa): boolean {
  return c.empresaId === p.empresaId && c.criadoPorId === p.usuarioId;
}

export function podeVer(c: CompromissoAcesso, p: Pessoa): boolean {
  if (c.empresaId !== p.empresaId) return false;
  return c.criadoPorId === p.usuarioId || c.participantesIds.includes(p.usuarioId);
}

/** Editar, excluir, mudar status e compartilhar: só o criador. */
export function podeAlterar(c: CompromissoAcesso, p: Pessoa): boolean {
  return ehCriador(c, p);
}
