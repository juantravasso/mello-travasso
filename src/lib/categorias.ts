import type { CategoriaGasto } from "@/types";

export const rotulosCategoria: Record<CategoriaGasto, string> = {
  material: "Material",
  mao_de_obra: "Mão de obra",
  equipamento: "Equipamento",
  transporte: "Transporte",
  servico_terceirizado: "Serviço terceirizado",
  taxa_licenca: "Taxa/Licença",
  outros: "Outros",
};

export const categorias: CategoriaGasto[] = Object.keys(rotulosCategoria) as CategoriaGasto[];
