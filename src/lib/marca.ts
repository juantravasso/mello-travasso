// Identidade da marca em um lugar só: nome, mensagem, áreas de produto e cores constantes.
// Textos de marca não devem ser repetidos nos componentes; importe daqui.

/** Cores da identidade (constantes, não tokens de tema): logo, ícones e imagem de compartilhamento. */
export const CORES_MARCA = {
  /** Fundo do símbolo e cor dos botões em e-mails. */
  navy: "#0f2a4a",
  /** Elo principal do símbolo. */
  elo: "#2dd4bf",
  /** Elo secundário: o outro lado da conexão. */
  ouro: "#e8b04b",
  /** Fundo escuro usado na imagem de compartilhamento. */
  noite: "#0b0e14",
  /** Fundo do tema claro (o padrão): barra do navegador e tela de abertura do app instalado. */
  fundoClaro: "#f5f6f8",
} as const;

export interface ProdutoMarca {
  nome: string;
  /** Uma frase curta, no imperativo. */
  chamada: string;
  descricao: string;
  /** Página de entrada pública da área; ausente enquanto a área não existir. */
  href?: string;
  /** Texto do link que leva a `href`. */
  acao?: string;
  /** false = só visão futura: não vira link, botão nem item de menu. */
  disponivel: boolean;
}

export const MARCA = {
  nome: "Elo Negócios",
  /** Para espaços curtos (nome do app instalado, abas). */
  nomeCurto: "Elo",
  slogan: "Seu negócio conectado a novas possibilidades.",
  /** Trecho do slogan que ganha cor em títulos grandes. */
  sloganDestaque: "novas possibilidades.",
  descricao: "Gerencie sua empresa, encontre profissionais confiáveis e descubra novas oportunidades em um só lugar.",
  /** Contato de suporte, cancelamento, reembolso e privacidade. NEXT_PUBLIC_EMAIL_CONTATO troca o endereço sem mexer no código. */
  emailContato: process.env.NEXT_PUBLIC_EMAIL_CONTATO?.trim() || "contato@eloprofissionais.com.br",
  produtos: {
    gestao: {
      nome: "Elo Gestão",
      chamada: "Administre sua empresa.",
      descricao:
        "Contas a pagar e a receber, projetos, estoque, funcionários e fornecedores, com captura de documentos por inteligência artificial.",
      href: "/criar-conta",
      acao: "Começar grátis",
      disponivel: true,
    },
    profissionais: {
      nome: "Elo Profissionais",
      chamada: "Encontre e avalie profissionais.",
      descricao:
        "Busque empresas e autônomos por profissão e cidade, veja perfis e trabalhos realizados e confie em avaliações de quem já contratou.",
      href: "/rede",
      acao: "Buscar profissionais",
      disponivel: true,
    },
    marketplace: {
      nome: "Elo Marketplace",
      chamada: "Descubra produtos e serviços.",
      descricao: "Uma área de compra e venda de produtos e serviços faz parte dos planos da plataforma, mas ainda não foi lançada.",
      disponivel: false,
    },
  },
} as const satisfies {
  nome: string;
  nomeCurto: string;
  slogan: string;
  sloganDestaque: string;
  descricao: string;
  emailContato: string;
  produtos: Record<"gestao" | "profissionais" | "marketplace", ProdutoMarca>;
};

export const SLOGAN_INICIO = MARCA.slogan.replace(MARCA.sloganDestaque, "").trim();

export type ChaveProduto = keyof typeof MARCA.produtos;

/** Metadados padrão; as páginas informam só o próprio título e herdam o sufixo do template. */
export const TITULO_PADRAO = `${MARCA.nome} | ${MARCA.slogan.replace(/\.$/, "")}`;
export const TEMPLATE_TITULO = `%s | ${MARCA.nome}`;
