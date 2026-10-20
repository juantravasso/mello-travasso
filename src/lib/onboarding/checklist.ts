import { temAlgumModulo, type AcessoDaPessoa, type ModuloChave } from "@/lib/auth/modulos";

// Checklist de ativação. Cada item é "feito" por um fato real nos dados (projeto criado, conta lançada, perfil
// publicado...), nunca por um clique em "concluir". Por isso nada disto é guardado como marcação: calcula-se de novo
// a cada leitura. A lista é personalizada pelo plano e pelos módulos da pessoa.

export interface SinaisDoChecklist {
  obras: number;
  contas: number;
  produtos: number;
  compromissos: number;
  perfilPublicado: boolean;
  /** Telefone e cidade da empresa preenchidos. */
  dadosEmpresaCompletos: boolean;
}

export interface ContextoChecklist {
  pessoa: AcessoDaPessoa;
  recursos: ReadonlySet<string>;
  plano: string;
  sinais: SinaisDoChecklist;
}

export interface ItemChecklist {
  id: string;
  titulo: string;
  descricao: string;
  /** Para onde o botão leva. */
  href: string;
  rotuloAcao: string;
  feito: boolean;
}

interface DefinicaoItem {
  id: string;
  titulo: string;
  descricao: string;
  href: (c: ContextoChecklist) => string;
  rotuloAcao: string;
  /** Só aparece para quem tem algum destes módulos. */
  modulos?: readonly ModuloChave[];
  recurso?: "gestao" | "rede";
  somenteDono?: boolean;
  /** Só para quem não tem este recurso (plano que só usa a rede). */
  semRecurso?: "gestao";
  feito: (c: ContextoChecklist) => boolean;
}

const ITENS: readonly DefinicaoItem[] = [
  {
    id: "dados_empresa",
    titulo: "Complete os dados da empresa",
    descricao: "Telefone e endereço aparecem em documentos e ajudam a rede a conhecer você.",
    href: () => "/configuracoes",
    rotuloAcao: "Completar dados",
    somenteDono: true,
    feito: (c) => c.sinais.dadosEmpresaCompletos,
  },
  {
    id: "primeiro_projeto",
    titulo: "Cadastre o primeiro projeto",
    descricao: "É por ele que contas e materiais ficam organizados.",
    href: () => "/obras/novo",
    rotuloAcao: "Novo projeto",
    modulos: ["projetos"],
    recurso: "gestao",
    feito: (c) => c.sinais.obras > 0,
  },
  {
    id: "primeira_conta",
    titulo: "Lance a primeira conta",
    descricao: "Fotografe uma nota ou lance à mão: a conta entra com o vencimento.",
    href: (c) => (temAlgumModulo(c.pessoa, ["captura"]) ? "/capturar" : "/contas-a-pagar"),
    rotuloAcao: "Lançar conta",
    modulos: ["captura", "contas_pagar"],
    recurso: "gestao",
    feito: (c) => c.sinais.contas > 0,
  },
  {
    id: "primeiro_produto",
    titulo: "Cadastre um produto no estoque",
    descricao: "Acompanhe o saldo de cada material por projeto e no Depósito.",
    href: () => "/estoque/novo",
    rotuloAcao: "Novo produto",
    modulos: ["estoque"],
    recurso: "gestao",
    feito: (c) => c.sinais.produtos > 0,
  },
  {
    id: "primeiro_compromisso",
    titulo: "Crie um compromisso no calendário",
    descricao: "Receba o lembrete por e-mail e no sistema, e compartilhe com a equipe se quiser.",
    href: () => "/calendario",
    rotuloAcao: "Novo compromisso",
    modulos: ["calendario"],
    recurso: "gestao",
    feito: (c) => c.sinais.compromissos > 0,
  },
  {
    id: "perfil_publicado",
    titulo: "Publique seu perfil no Elo Profissionais",
    descricao: "Com o perfil publicado, você aparece na busca por profissão e cidade.",
    href: () => "/minha-rede/perfil",
    rotuloAcao: "Abrir meu perfil",
    modulos: ["rede"],
    recurso: "rede",
    feito: (c) => c.sinais.perfilPublicado,
  },
  {
    id: "experimentar_gestao",
    titulo: "Experimente o Elo Gestão",
    descricao: "Projetos, contas, estoque, captura de notas e calendário. O teste começa quando você pedir.",
    href: () => "/dashboard",
    rotuloAcao: "Conhecer",
    somenteDono: true,
    semRecurso: "gestao",
    // Fato real: a empresa deixou o plano que só tem a rede.
    feito: (c) => c.plano !== "gratuito",
  },
];

export function calcularChecklist(c: ContextoChecklist): ItemChecklist[] {
  return ITENS.filter((i) => {
    if (i.somenteDono && c.pessoa.papel !== "dono") return false;
    if (i.semRecurso && c.recursos.has(i.semRecurso)) return false;
    if (i.recurso && !c.recursos.has(i.recurso)) return false;
    if (i.modulos && !temAlgumModulo(c.pessoa, i.modulos)) return false;
    return true;
  }).map((i) => ({ id: i.id, titulo: i.titulo, descricao: i.descricao, href: i.href(c), rotuloAcao: i.rotuloAcao, feito: i.feito(c) }));
}

export interface ResumoChecklist {
  itens: ItemChecklist[];
  feitos: number;
  total: number;
  /** O primeiro item ainda pendente: "continuar de onde parou". */
  proximo: ItemChecklist | null;
}

export function resumirChecklist(itens: ItemChecklist[]): ResumoChecklist {
  const feitos = itens.filter((i) => i.feito).length;
  return { itens, feitos, total: itens.length, proximo: itens.find((i) => !i.feito) ?? null };
}
