/** Uma categoria ou forma de pagamento criada pelo usuário (além das padrão). */
export interface OpcaoPersonalizada {
  id: string;
  rotulo: string;
  criadoEm: string;
}

export type NovaOpcaoPersonalizadaInput = Omit<OpcaoPersonalizada, "id" | "criadoEm">;
