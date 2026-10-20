export interface PlanoComercialPublico {
  chave: string;
  nome: string;
  descricao: string;
  precoMensalCentavos: number | null;
  precoAnualCentavos: number | null;
  beneficios: string[];
  destaque: boolean;
  /** Limite de vagas do plano (ex.: fundador); null = sem limite. */
  vagasTotal: number | null;
  /** Vagas que sobram, calculadas no servidor a partir das empresas que de fato ocupam o plano; null = sem limite. */
  vagasRestantes: number | null;
  /** Número de parcelas sem juros confirmado pelo provedor de pagamento; null = a página não promete parcelamento. */
  parcelasSemJuros: number | null;
  condicao: string | null;
}

export interface PlanoComercialAdmin extends PlanoComercialPublico {
  publicado: boolean;
  ordem: number;
  atualizadoEm: string;
  vagasOcupadas: number;
}
