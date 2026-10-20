import { temAlgumModulo, type AcessoDaPessoa, type ModuloChave } from "@/lib/auth/modulos";

// Passos do tour inicial. A lista é montada no servidor para a pessoa: só entram os passos de módulos que ela usa e
// que o plano da empresa inclui. O texto fala do que existe; nada de promessa de resultado.

export interface PassoTour {
  id: string;
  titulo: string;
  texto: string;
  acao?: { rotulo: string; href: string };
}

interface DefinicaoPasso extends PassoTour {
  /** Só aparece para quem tem algum destes módulos (e o plano inclui o recurso). */
  modulos?: readonly ModuloChave[];
  recurso?: "gestao" | "rede";
  /** Só para quem não tem o recurso (ex.: plano que só usa a rede). */
  semRecurso?: "gestao";
}

const PASSOS: readonly DefinicaoPasso[] = [
  {
    id: "boas_vindas",
    titulo: "Bem-vindo ao Elo Negócios",
    texto:
      "Aqui você organiza a gestão do seu negócio (projetos, contas, estoque e calendário) e participa de uma rede de empresas e profissionais. Este tour leva um minuto e você pode pular ou voltar a ele quando quiser.",
  },
  {
    id: "projetos_e_contas",
    titulo: "Organize por projeto",
    texto: "Cada obra ou serviço vira um projeto. As contas a pagar e a receber ficam ligadas a ele, então dá para ver quanto cada um já custou e o que ainda vence.",
    modulos: ["projetos", "contas_pagar", "contas_receber", "dashboard"],
    recurso: "gestao",
    acao: { rotulo: "Ver meus projetos", href: "/obras" },
  },
  {
    id: "captura",
    titulo: "Lance notas pela foto",
    texto: "Fotografe uma nota ou comprovante: o sistema lê os dados e você só confere. Cada item pode ir para um projeto ou para o Depósito.",
    modulos: ["captura"],
    recurso: "gestao",
    acao: { rotulo: "Abrir a captura", href: "/capturar" },
  },
  {
    id: "estoque",
    titulo: "Estoque e Depósito",
    texto: "Acompanhe o saldo de cada material por projeto e no Depósito. Transferir do Depósito para um projeto leva o custo junto.",
    modulos: ["estoque"],
    recurso: "gestao",
    acao: { rotulo: "Abrir o estoque", href: "/estoque" },
  },
  {
    id: "calendario",
    titulo: "Compromissos e lembretes",
    texto: "Crie compromissos com data e hora e receba o aviso por e-mail e no sistema. Também dá para compartilhar com a equipe.",
    modulos: ["calendario"],
    recurso: "gestao",
    acao: { rotulo: "Abrir o calendário", href: "/calendario" },
  },
  {
    id: "rede",
    titulo: "Seu perfil no Elo Profissionais",
    texto: "Publique o seu perfil para ser encontrado na busca por profissão e cidade, e mostre seus trabalhos. Para publicar, é preciso confirmar o e-mail.",
    modulos: ["rede"],
    recurso: "rede",
    acao: { rotulo: "Completar meu perfil", href: "/minha-rede/perfil" },
  },
  {
    id: "conhecer_gestao",
    titulo: "O Elo Gestão está disponível",
    texto: "Além da rede, a plataforma tem os módulos de gestão (projetos, contas, estoque, captura e calendário). O responsável pela conta pode experimentá-los quando quiser.",
    semRecurso: "gestao",
    acao: { rotulo: "Conhecer o Elo Gestão", href: "/dashboard" },
  },
  {
    id: "ajuda",
    titulo: "Onde encontrar ajuda",
    texto: "Em cada tela há um botão Como funciona? com o passo a passo. Todos os tutoriais, o checklist e este tour ficam em Ajuda e tutoriais.",
    acao: { rotulo: "Abrir Ajuda e tutoriais", href: "/ajuda" },
  },
];

export function passosDoTour(pessoa: AcessoDaPessoa, recursos: ReadonlySet<string>): PassoTour[] {
  return PASSOS.filter((p) => {
    if (p.semRecurso && recursos.has(p.semRecurso)) return false;
    if (p.recurso && !recursos.has(p.recurso)) return false;
    if (p.modulos && !temAlgumModulo(pessoa, p.modulos)) return false;
    return true;
  }).map(({ id, titulo, texto, acao }) => ({ id, titulo, texto, acao }));
}

export type EstadoTour = "nao_iniciado" | "em_andamento" | "concluido" | "pulado";
export const ESTADOS_TOUR: readonly EstadoTour[] = ["nao_iniciado", "em_andamento", "concluido", "pulado"];

/** O tour abre sozinho só para quem acabou de se cadastrar; quem já usa o sistema o revê em Ajuda. */
export const JANELA_TOUR_AUTOMATICO_DIAS = 14;
