export interface MetricasCoorte {
  cadastros: number;
  /** true quando havia mais cadastros do que o limite de leitura (os números cobrem só os mais recentes). */
  truncado: boolean;
  emailConfirmado: number;
  ativadas: number;
  porIndicacao: number;
  tour: { concluido: number; pulado: number; emAndamento: number; naoIniciado: number };
}

export interface MetricasTeste {
  iniciados: number;
  emAndamento: number;
  /** Prazo terminado ou plano já trocado: base da taxa de conversão. */
  amadurecidos: number;
  convertidos: number;
  comExtensao: { amadurecidos: number; convertidos: number };
  semExtensao: { amadurecidos: number; convertidos: number };
  extensoes: number;
  diasEstendidos: number;
}

export interface RetencaoSemana {
  /** 1 = os 7 primeiros dias depois do cadastro. */
  semana: number;
  /** Empresas do período cujo cadastro já completou esta semana inteira. */
  base: number;
  /** Delas, as que registraram alguma ação nesta semana. */
  retidas: number;
}

export interface MetricasRetencao {
  semanas: RetencaoSemana[];
  /** true quando havia mais registros de atividade do que o limite de leitura (a retenção sai subestimada). */
  truncado: boolean;
}

export interface MetricasCampanha {
  campanha: string;
  enviados: number;
  falhas: number;
  cancelados: number;
  naFila: number;
}

export interface MetricasOferta {
  contexto: string;
  vistas: number;
  cliques: number;
}

export interface MetricasPlataforma {
  periodoDias: number;
  desde: string;
  ate: string;
  /** Primeiro evento de produto registrado: antes disso só existem os números lidos direto das tabelas. */
  eventosDesde: string | null;
  coorte: MetricasCoorte;
  teste: MetricasTeste;
  retencao: MetricasRetencao;
  ofertas: { porContexto: MetricasOferta[] };
  emails: { campanhas: MetricasCampanha[]; descadastros: number };
}
