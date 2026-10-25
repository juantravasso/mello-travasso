import type { CategoriaCompromisso, StatusCompromisso } from "@/lib/calendario/categorias";

export type { CategoriaCompromisso, StatusCompromisso };

export interface PessoaResumo {
  id: string;
  nome: string;
}

export interface CompromissoItem {
  id: string;
  titulo: string;
  descricao?: string;
  categoria: CategoriaCompromisso;
  status: StatusCompromisso;
  /** AAAA-MM-DD no fuso do compromisso. */
  data: string;
  diaInteiro: boolean;
  /** "HH:mm" local; ausente em dia inteiro. */
  horaInicio?: string;
  horaFim?: string;
  criadoPor: PessoaResumo;
  /** Com quem o criador compartilhou (o criador não entra). */
  participantes: PessoaResumo[];
  /** O usuário que consulta é o responsável: só ele edita, exclui e compartilha. */
  souCriador: boolean;
  /** Presente quando o item é uma conta a pagar ou a receber em aberto (aparece no calendário no dia do vencimento). */
  conta?: { tipo: "pagar" | "receber"; href: string; valor: number; atrasada: boolean };
}

export interface ListaCompromissos {
  /** Hoje no fuso da empresa (AAAA-MM-DD): a grade usa isto, não o relógio do navegador. */
  hoje: string;
  fuso: string;
  itens: CompromissoItem[];
}

export interface ColegaItem {
  id: string;
  nome: string;
  email: string;
}

export interface EntradaCompromisso {
  titulo: string;
  descricao?: string;
  categoria: CategoriaCompromisso;
  data: string;
  diaInteiro: boolean;
  horaInicio?: string;
  horaFim?: string;
  status?: StatusCompromisso;
  participantesIds: string[];
}

export interface PreferenciasCalendario {
  lembretesPorEmail: boolean;
  lembretesNoApp: boolean;
  fusoHorario: string;
  /** Só o dono da empresa muda o fuso. */
  podeAlterarFuso: boolean;
}
