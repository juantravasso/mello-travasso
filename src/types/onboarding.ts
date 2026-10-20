import type { ItemChecklist } from "@/lib/onboarding/checklist";
import type { EstadoTour, PassoTour } from "@/lib/onboarding/tour";

export type { EstadoTour, ItemChecklist, PassoTour };

/** O tour, já filtrado pelo servidor para esta pessoa (plano e módulos). */
export interface TourOnboarding {
  estado: EstadoTour;
  /** Passo em que a pessoa parou (para retomar). */
  passo: number;
  passos: PassoTour[];
  /** Abre sozinho: cadastro recente e tour ainda não visto. Quem já usa o sistema não leva susto. */
  abrirAutomaticamente: boolean;
}

export interface ChecklistOnboarding {
  itens: ItemChecklist[];
  feitos: number;
  total: number;
  /** Primeiro item pendente: "continuar de onde parou". */
  proximoId: string | null;
  oculto: boolean;
}

/** Leitura leve (2 consultas): vai em toda página, por isso não calcula o checklist. */
export interface TourComAjudas {
  tour: TourOnboarding;
  /** Chaves (de módulo) dos tutoriais já abertos. */
  ajudasVistas: string[];
}

export interface EstadoOnboarding extends TourComAjudas {
  checklist: ChecklistOnboarding;
}
