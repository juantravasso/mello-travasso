// Módulos que o dono da empresa libera para cada funcionário. Uma definição só, usada pelo menu, pelas páginas e
// pelas Server Actions. O dono (papel "dono") sempre tem todos; um membro tem só os que o dono marcou.
//
// Regra de uso: o menu esconde, a página mostra "sem acesso" e, principalmente, cada Server Action confere no
// servidor (ver DAL). Esconder o menu nunca é a proteção.

export type RecursoDoPlano = "gestao" | "rede";

export interface DefinicaoModulo {
  chave: string;
  rotulo: string;
  descricao: string;
  /** Recurso do plano da empresa de que o módulo depende (Elo Gestão ou Elo Profissionais). */
  recurso: RecursoDoPlano;
  /** Página de entrada do módulo. */
  rota: string;
  /** Rotas que pertencem ao módulo (por prefixo). */
  prefixos: readonly string[];
}

export const MODULOS = [
  { chave: "dashboard", rotulo: "Painel principal", descricao: "Resumo financeiro e indicadores.", recurso: "gestao", rota: "/dashboard", prefixos: ["/dashboard"] },
  { chave: "calendario", rotulo: "Calendário", descricao: "Compromissos e lembretes.", recurso: "gestao", rota: "/calendario", prefixos: ["/calendario"] },
  { chave: "captura", rotulo: "Captura de documentos", descricao: "Ler comprovantes e notas por foto.", recurso: "gestao", rota: "/capturar", prefixos: ["/capturar"] },
  { chave: "contas_pagar", rotulo: "Contas a pagar", descricao: "Lançar, editar e dar baixa em despesas.", recurso: "gestao", rota: "/contas-a-pagar", prefixos: ["/contas-a-pagar"] },
  { chave: "contas_receber", rotulo: "Contas a receber", descricao: "Lançar, editar e dar baixa em receitas.", recurso: "gestao", rota: "/contas-a-receber", prefixos: ["/contas-a-receber"] },
  { chave: "projetos", rotulo: "Projetos", descricao: "Cadastro e acompanhamento dos projetos.", recurso: "gestao", rota: "/obras", prefixos: ["/obras"] },
  { chave: "estoque", rotulo: "Estoque", descricao: "Produtos, saldos e movimentações.", recurso: "gestao", rota: "/estoque", prefixos: ["/estoque", "/custos-produtos"] },
  { chave: "funcionarios", rotulo: "Funcionários", descricao: "Cadastro de funcionários e alocação em projetos.", recurso: "gestao", rota: "/funcionarios", prefixos: ["/funcionarios"] },
  { chave: "fornecedores", rotulo: "Fornecedores", descricao: "Cadastro de fornecedores.", recurso: "gestao", rota: "/fornecedores", prefixos: ["/fornecedores"] },
  { chave: "rede", rotulo: "Elo Profissionais", descricao: "Perfil público, avaliações e indicações.", recurso: "rede", rota: "/minha-rede", prefixos: ["/minha-rede"] },
] as const satisfies readonly DefinicaoModulo[];

export type ModuloChave = (typeof MODULOS)[number]["chave"];

export const CHAVES_MODULO: readonly ModuloChave[] = MODULOS.map((m) => m.chave);
const CONJUNTO = new Set<string>(CHAVES_MODULO);

export function ehModulo(valor: unknown): valor is ModuloChave {
  return typeof valor === "string" && CONJUNTO.has(valor);
}

/** Descarta o que não é módulo conhecido (valor antigo ou adulterado) e repetições. */
export function normalizarModulos(valores: readonly unknown[]): ModuloChave[] {
  return CHAVES_MODULO.filter((c) => valores.includes(c));
}

export function definicaoDoModulo(chave: ModuloChave): DefinicaoModulo {
  return MODULOS.find((m) => m.chave === chave) as DefinicaoModulo;
}

export function rotuloDoModulo(chave: string): string {
  return MODULOS.find((m) => m.chave === chave)?.rotulo ?? chave;
}

/** Módulos do dono: todos. */
export const TODOS_OS_MODULOS: readonly ModuloChave[] = CHAVES_MODULO;

/** Os de gestão (tudo, menos o Elo Profissionais). */
export const MODULOS_DE_GESTAO: readonly ModuloChave[] = MODULOS.filter((m) => m.recurso === "gestao").map((m) => m.chave);

/**
 * Quais módulos dão acesso a cada ação. "Ler" é mais largo que "escrever" porque um módulo usa cadastros dos
 * outros como referência (a conta escolhe um projeto, o estoque escolhe um projeto, a captura escolhe um
 * fornecedor…): quem tem o módulo enxerga a lista, mas só altera o cadastro quem tem o módulo dele.
 */
export const ACESSO = {
  obrasLer: ["projetos", "contas_pagar", "contas_receber", "captura", "estoque", "funcionarios", "dashboard"],
  obrasEscrever: ["projetos"],
  fornecedoresLer: ["fornecedores", "contas_pagar", "captura", "estoque"],
  /** Criar um fornecedor na hora de lançar uma conta ou ler um comprovante. */
  fornecedoresCriar: ["fornecedores", "contas_pagar", "captura"],
  fornecedoresAlterar: ["fornecedores"],
  funcionariosLer: ["funcionarios", "projetos"],
  funcionariosEscrever: ["funcionarios"],
  catalogoLer: ["contas_pagar", "contas_receber", "captura", "dashboard"],
  catalogoEscrever: ["contas_pagar", "contas_receber", "captura"],
  estoque: ["estoque"],
  /** Gravar uma captura (conta, itens e entrada no estoque) de uma vez. */
  captura: ["captura"],
  /** Ver o gasto que o material transferido do Depósito gera em cada projeto. */
  transferenciasLer: ["estoque", "projetos", "dashboard"],
  itensProdutoLer: ["estoque", "contas_pagar", "captura", "fornecedores"],
  itensProdutoEscrever: ["captura", "contas_pagar", "estoque"],
  leituraDeComprovante: ["captura", "contas_pagar", "contas_receber"],
  calendario: ["calendario"],
  /** Contas a pagar: quem lê (inclui quem usa o dado em outra tela) e quem lança. */
  contasPagarLer: ["contas_pagar", "captura", "dashboard", "projetos"],
  contasPagarEscrever: ["contas_pagar", "captura"],
  contasReceberLer: ["contas_receber", "dashboard", "projetos"],
  contasReceberEscrever: ["contas_receber"],
} as const satisfies Record<string, readonly ModuloChave[]>;

export type ChaveAcesso = keyof typeof ACESSO;

/** Pessoa e módulos já resolvidos pela sessão: o dono vem com todos. */
export interface AcessoDaPessoa {
  papel: "dono" | "membro";
  modulos: readonly ModuloChave[];
}

/** Tem algum dos módulos da lista? Lista vazia = qualquer módulo de gestão. */
export function temAlgumModulo(pessoa: AcessoDaPessoa, lista: readonly ModuloChave[] = MODULOS_DE_GESTAO): boolean {
  if (pessoa.papel === "dono") return true;
  return lista.some((m) => pessoa.modulos.includes(m));
}

/** O módulo (ou o conjunto "cadastro") a que uma rota pertence; null = rota livre (ex.: Configurações). */
export type ModuloDaRota = ModuloChave | "cadastro" | null;

export function moduloDaRota(pathname: string): ModuloDaRota {
  const caminho = pathname.split("?")[0] ?? pathname;
  if (caminho === "/cadastro" || caminho.startsWith("/cadastro/")) return "cadastro";
  for (const m of MODULOS) {
    if (m.prefixos.some((p) => caminho === p || caminho.startsWith(`${p}/`))) return m.chave;
  }
  return null;
}

const MODULOS_DO_CADASTRO: readonly ModuloChave[] = ["projetos", "funcionarios", "fornecedores"];

export function podeAcessarRota(pessoa: AcessoDaPessoa, pathname: string): boolean {
  const modulo = moduloDaRota(pathname);
  if (modulo === null) return true;
  if (modulo === "cadastro") return temAlgumModulo(pessoa, MODULOS_DO_CADASTRO);
  return temAlgumModulo(pessoa, [modulo]);
}

/** Primeira página que a pessoa pode abrir, na ordem do menu; usada depois do login e no "sem acesso". */
export function primeiraRotaPermitida(pessoa: AcessoDaPessoa, recursos: ReadonlySet<string>): string {
  const modulo = MODULOS.find((m) => recursos.has(m.recurso) && temAlgumModulo(pessoa, [m.chave]));
  return modulo?.rota ?? "/configuracoes";
}

/** Módulos que a empresa pode liberar, conforme o plano (gratuito não tem os de gestão). */
export function modulosDisponiveis(recursos: ReadonlySet<string>): ModuloChave[] {
  return MODULOS.filter((m) => recursos.has(m.recurso)).map((m) => m.chave);
}
