// Conteúdo comercial da página de planos: os problemas do dia a dia que o sistema resolve e tudo o que o Elo Gestão
// inclui. Cada item descreve algo que o sistema de fato faz hoje (mesma base dos tutoriais em onboarding/ajuda.ts), em
// linguagem de benefício possível, sem prometer resultado. Ao mudar uma funcionalidade, confira o texto daqui.

export interface ProblemaResolvido {
  id: string;
  /** A dor, como o dono da empresa a descreveria. */
  problema: string;
  /** O que o sistema faz a respeito. */
  solucao: string;
  /** Funcionalidade que resolve (rótulo curto). */
  recurso: string;
}

export const PROBLEMAS: readonly ProblemaResolvido[] = [
  {
    id: "notas_perdidas",
    problema: "Nota e comprovante se perdem, e digitar tudo na mão toma tempo.",
    solucao: "Fotografe a nota: o sistema lê os dados com IA e você só confere antes de salvar. O comprovante fica guardado junto da conta.",
    recurso: "Captura de documentos",
  },
  {
    id: "conta_vencida",
    problema: "A conta venceu e ninguém viu.",
    solucao: "Contas a pagar e a receber ficam numa lista com vencimento e situação, e o calendário avisa por e-mail e dentro do sistema.",
    recurso: "Contas a pagar e a receber · Calendário",
  },
  {
    id: "custo_da_obra",
    problema: "Você só descobre quanto uma obra gastou quando já passou do orçamento.",
    solucao: "Cada conta é ligada a um projeto. O painel mostra o orçamento, o que já foi gasto e os gastos por categoria.",
    recurso: "Projetos · Painel",
  },
  {
    id: "material",
    problema: "Material some, compra repetida e ninguém sabe o que tem em cada obra.",
    solucao: "O estoque tem saldo por local (cada projeto e o Depósito), com entradas, saídas, transferências e o rateio de uma nota entre projetos.",
    recurso: "Estoque · Depósito",
  },
  {
    id: "equipe",
    problema: "Ou a equipe vê tudo, ou não vê nada.",
    solucao: "Você cria os usuários da empresa e libera só os módulos de cada pessoa. Funcionários ficam alocados nos projetos.",
    recurso: "Usuários por módulo · Funcionários",
  },
  {
    id: "compromissos",
    problema: "Visitas, prazos e cobranças espalhados em conversas e na memória.",
    solucao: "Compromissos com data e hora, com lembrete, seus ou compartilhados com a equipe, num calendário só.",
    recurso: "Calendário compartilhado",
  },
  {
    id: "novos_clientes",
    problema: "Sua empresa só é encontrada por quem já conhece você.",
    solucao: "Seu perfil na rede, com portfólio e avaliações, aparece na busca de quem procura profissionais e empresas.",
    recurso: "Elo Profissionais",
  },
];

export interface GrupoFuncionalidades {
  titulo: string;
  itens: readonly string[];
}

export const FUNCIONALIDADES: readonly GrupoFuncionalidades[] = [
  { titulo: "Financeiro", itens: ["Captura de documentos com IA", "Contas a pagar", "Contas a receber", "Fornecedores", "Painel com orçamento, gastos e vencimentos"] },
  { titulo: "Obras e materiais", itens: ["Projetos com orçamento e custo", "Estoque por local", "Depósito com transferências e rateio de notas"] },
  { titulo: "Equipe", itens: ["Usuários da empresa com acesso por módulo", "Funcionários alocados nos projetos", "Calendário com lembretes e compromissos compartilhados"] },
  { titulo: "Rede", itens: ["Perfil público com portfólio e avaliações", "Link de convite para indicar outras empresas"] },
];
