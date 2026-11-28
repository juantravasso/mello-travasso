import { configLembretes, type ConfigLembretes } from "./config";
import { adicionarDias, instanteLocal } from "./tempo";

// Cálculo e reagendamento dos lembretes de um compromisso. Tudo aqui é puro (sem banco, sem relógio próprio):
// quem chama passa "agora", o que torna as regras verificáveis em teste.

export type TipoLembrete = "vespera" | "dia" | "antes";
export const TIPOS_LEMBRETE: readonly TipoLembrete[] = ["vespera", "dia", "antes"];
/** Maior antecedência aceita para o aviso extra: 7 dias. */
export const MAX_AVISO_MINUTOS = 7 * 24 * 60;

const MS_MINUTO = 60_000;
const MS_DIA = 24 * 60 * MS_MINUTO;

export interface CompromissoParaLembretes {
  data: string;
  diaInteiro: boolean;
  horaInicio?: string | null;
  fuso: string;
  inicioEm: string;
  /** Aviso extra X minutos antes do início (0 = na hora). null/ausente = sem aviso extra. */
  avisoMinutosAntes?: number | null;
  /** Véspera e dia. Ausente = ligados (compromissos do app). */
  lembretesPadrao?: boolean;
}

export interface Disparo {
  tipo: TipoLembrete;
  disparoEm: string;
}

function hora(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

/**
 * Quando cada lembrete DEVERIA sair, sem olhar o relógio.
 *
 * - Com horário: a véspera sai 24 h antes do início. O lembrete do dia sai na hora configurada (padrão 8h) do
 *   dia do compromisso, mas nunca a menos de 60 min do início e nunca antes da meia-noite local.
 * - Dia inteiro: véspera e dia saem na hora padrão configurada (padrão 9h), no dia anterior e no próprio dia.
 * - Aviso extra ("antes"): X minutos antes do início; em dia inteiro, antes da hora padrão do dia. Só existe quando
 *   pedido (avisoMinutosAntes), e a véspera/dia somem quando lembretesPadrao é false (lembrete simples do assistente).
 */
export function calcularDisparos(c: CompromissoParaLembretes, config: ConfigLembretes = configLembretes()): Partial<Record<TipoLembrete, Date>> {
  const padrao = c.lembretesPadrao !== false;
  const aviso = typeof c.avisoMinutosAntes === "number" && c.avisoMinutosAntes >= 0 ? Math.min(c.avisoMinutosAntes, MAX_AVISO_MINUTOS) : null;
  const disparos: Partial<Record<TipoLembrete, Date>> = {};
  if (c.diaInteiro) {
    const horaDoDia = instanteLocal(c.data, hora(config.horaDiaInteiro), c.fuso);
    if (padrao) {
      disparos.vespera = instanteLocal(adicionarDias(c.data, -1), hora(config.horaDiaInteiro), c.fuso);
      disparos.dia = horaDoDia;
    }
    if (aviso !== null) disparos.antes = new Date(horaDoDia.getTime() - aviso * MS_MINUTO);
    return disparos;
  }
  const inicio = new Date(c.inicioEm).getTime();
  if (padrao) {
    const meiaNoite = instanteLocal(c.data, "00:00", c.fuso).getTime();
    const horaPadrao = instanteLocal(c.data, hora(config.horaDoDia), c.fuso).getTime();
    disparos.vespera = new Date(inicio - MS_DIA);
    disparos.dia = new Date(Math.max(meiaNoite, Math.min(horaPadrao, inicio - config.antecedenciaDoDiaMin * MS_MINUTO)));
  }
  if (aviso !== null) disparos.antes = new Date(inicio - aviso * MS_MINUTO);
  return disparos;
}

/**
 * Lembretes a agendar agora: só os que ainda estão no futuro. Um lembrete cujo horário já passou não é
 * enviado depois do fato (sem notificação retroativa), mesmo que o compromisso ainda não tenha acontecido.
 */
export function agendarLembretes(c: CompromissoParaLembretes, agora: Date, config?: ConfigLembretes): Disparo[] {
  const disparos = calcularDisparos(c, config);
  return TIPOS_LEMBRETE.flatMap((tipo) => {
    const quando = disparos[tipo];
    return quando && quando.getTime() > agora.getTime() ? [{ tipo, disparoEm: quando.toISOString() }] : [];
  });
}

/**
 * Compromisso pontual (sem horário de término: início = fim, como o "me lembra às 9h") ainda merece o aviso nestes
 * minutos depois do horário: o agendador pode atrasar uns minutos, e sem a folga o aviso "na hora" nunca sairia.
 */
export const FOLGA_PONTUAL_MIN = 30;

/** O compromisso ainda justifica um aviso? Só se estiver agendado e não tiver terminado. */
export function aindaFazSentidoAvisar(c: { status: string; fimEm: string; inicioEm?: string }, agora: Date): boolean {
  if (c.status !== "agendado") return false;
  const fim = new Date(c.fimEm).getTime();
  const pontual = c.inicioEm !== undefined && c.inicioEm === c.fimEm;
  return agora.getTime() <= fim + (pontual ? FOLGA_PONTUAL_MIN * MS_MINUTO : 0);
}

export interface LembreteExistente {
  tipo: TipoLembrete;
  disparoEm: string;
  status: "pendente" | "processando" | "processado" | "ignorado";
  versao: number;
}

export type AcaoLembrete =
  | { tipo: TipoLembrete; acao: "criar"; disparoEm: string; versao: 1 }
  | { tipo: TipoLembrete; acao: "atualizar"; disparoEm: string; versao: number }
  | { tipo: TipoLembrete; acao: "ignorar" }
  | { tipo: TipoLembrete; acao: "manter" };

/**
 * Compara o que já está agendado com o que o compromisso pede agora.
 *
 * - Horário igual e lembrete ainda válido: mantém (não reenvia nada por uma edição que não mexeu na data).
 * - Horário diferente, ou lembrete que estava ignorado: atualiza e sobe a versão, o que permite avisar de novo.
 * - O horário novo já passou: um lembrete ainda não enviado é ignorado; um já enviado fica como está.
 */
export function planejarReagendamento(existentes: LembreteExistente[], novos: Disparo[]): AcaoLembrete[] {
  return TIPOS_LEMBRETE.map((tipo): AcaoLembrete => {
    const novo = novos.find((n) => n.tipo === tipo);
    const atual = existentes.find((e) => e.tipo === tipo);
    if (!novo) {
      return atual && (atual.status === "pendente" || atual.status === "processando") ? { tipo, acao: "ignorar" } : { tipo, acao: "manter" };
    }
    if (!atual) return { tipo, acao: "criar", disparoEm: novo.disparoEm, versao: 1 };
    if (atual.disparoEm === novo.disparoEm && atual.status !== "ignorado") return { tipo, acao: "manter" };
    return { tipo, acao: "atualizar", disparoEm: novo.disparoEm, versao: atual.versao + 1 };
  });
}
