export interface PlanoComercialPublico {
  chave: string;
  nome: string;
  descricao: string;
  precoMensalCentavos: number | null;
  precoAnualCentavos: number | null;
  beneficios: string[];
  destaque: boolean;
}

export interface PlanoComercialAdmin extends PlanoComercialPublico {
  publicado: boolean;
  ordem: number;
  atualizadoEm: string;
}
