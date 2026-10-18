/** O link de convite da empresa: quem cria a conta por ele abre a própria empresa, separada desta. */
export interface ResumoConvite {
  codigo: string;
  link: string;
  /** Quantas empresas se cadastraram por este link. Só a contagem: nada das empresas convidadas aparece. */
  total: number;
}
