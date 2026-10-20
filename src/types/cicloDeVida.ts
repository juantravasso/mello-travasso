import type { ConfigCicloDeVida } from "@/lib/cicloDeVida/config";

export type { ConfigCicloDeVida };

/** Uma empresa em teste (ou com teste recém-encerrado), como a administração a vê. */
export interface TesteDaEmpresaAdmin {
  empresaId: string;
  /** Nome já protegido (autônomo e nome que parece documento não aparecem). */
  nome: string;
  fimAtual: string | null;
  /** Fim antes de qualquer extensão. */
  fimOriginal: string | null;
  extensoes: number;
  diasEstendidos: number;
  encerrado: boolean;
  diasRestantes: number | null;
}

export interface ExtensaoRegistroAdmin {
  id: string;
  dias: number;
  motivo: string;
  fimAnterior: string;
  fimNovo: string;
  criadoEm: string;
  concedidaPor: string;
}

export interface HistoricoTesteAdmin {
  fimOriginal: string | null;
  fimAtual: string | null;
  extensoes: ExtensaoRegistroAdmin[];
}

/** Dono recém-cadastrado e o que já fez: base para saber quem está parado no onboarding. */
export interface OnboardingAdminItem {
  empresaId: string;
  nome: string;
  plano: string;
  criadoEm: string;
  emailConfirmado: boolean;
  contas: number;
  obras: number;
  produtos: number;
  compromissos: number;
  perfilPublicado: boolean;
}

export interface FalhaEmailAdmin {
  id: string;
  campanha: string;
  /** Endereço parcialmente oculto (a administração não precisa do e-mail inteiro). */
  destino: string;
  tentativas: number;
  erro: string | null;
  criadoEm: string;
}

export interface PainelCicloDeVidaAdmin {
  config: ConfigCicloDeVida;
  testes: TesteDaEmpresaAdmin[];
  onboarding: OnboardingAdminItem[];
  emails: {
    /** E-mails dos últimos 30 dias por situação (pendente, enviado, falhou, cancelado). */
    porStatus: Record<string, number>;
    falhas: FalhaEmailAdmin[];
  };
}

export interface PreferenciaComunicacao {
  emailsPromocionais: boolean;
}
