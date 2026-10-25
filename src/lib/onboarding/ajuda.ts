import { moduloDaRota, temAlgumModulo, type AcessoDaPessoa, type ModuloChave } from "@/lib/auth/modulos";
import { MODULOS } from "@/lib/auth/modulos";

// Ajuda "Como funciona?" de cada módulo: o que é, qual problema resolve, benefícios, passo a passo, um exemplo e a
// próxima ação. O texto só descreve o que a tela realmente faz (confira ao mudar uma tela) e fala de benefício
// possível, nunca de resultado garantido. A chave é a do módulo: o botão aparece nas telas daquele módulo.

export interface ConteudoAjuda {
  chave: ModuloChave;
  titulo: string;
  oQueE: string;
  problema: string;
  beneficios: string[];
  passos: string[];
  exemplo: string;
  acao: { rotulo: string; href: string };
}

export const AJUDAS: Record<ModuloChave, ConteudoAjuda> = {
  dashboard: {
    chave: "dashboard",
    titulo: "Painel principal",
    oQueE: "Uma tela de resumo: quanto está em aberto, quanto foi pago e recebido no mês, o andamento do orçamento de cada projeto e os gastos por categoria.",
    problema: "Saber onde está o dinheiro costuma exigir abrir várias planilhas ou telas e somar à mão.",
    beneficios: ["Os números saem dos lançamentos que você já fez, sem digitar de novo.", "Mostra de relance o que vence, o que já foi pago e quais projetos estão perto do orçamento."],
    passos: ["Cadastre seus projetos e lance as contas a pagar e a receber.", "Volte ao Painel principal: os totais e o progresso de cada projeto aparecem sozinhos.", "Use o resumo para decidir o que olhar primeiro."],
    exemplo: "Você lançou as compras de material de uma obra. No Painel principal, o projeto mostra quanto do orçamento já foi gasto e o total em aberto sobe com as contas que ainda vencem.",
    acao: { rotulo: "Abrir o Painel principal", href: "/dashboard" },
  },
  calendario: {
    chave: "calendario",
    titulo: "Calendário",
    oQueE: "Compromissos com data e hora (ou o dia inteiro), com aviso por e-mail e dentro do sistema, só seus ou compartilhados com a equipe.",
    problema: "Visitas, entregas e vencimentos que vivem na memória ou em mensagens soltas acabam esquecidos.",
    beneficios: ["O sistema avisa na véspera e no dia, por e-mail e no sino de notificações.", "Dá para compartilhar um compromisso com colegas que também têm o módulo."],
    passos: ["Abra o Calendário e clique em Novo compromisso.", "Informe o título, a data e a hora (ou marque Dia inteiro).", "Escolha o lembrete e, se quiser, Compartilhar com alguém da equipe.", "Salve: o aviso sai no horário combinado."],
    exemplo: "Entrega de concreto na quinta, às 8h. Você cria o compromisso, compartilha com o encarregado da obra e os dois recebem o lembrete.",
    acao: { rotulo: "Criar um compromisso", href: "/calendario" },
  },
  captura: {
    chave: "captura",
    titulo: "Captura de documentos",
    oQueE: "Você fotografa (ou envia o arquivo de) uma nota ou comprovante, o sistema lê os dados com IA e você só confere antes de salvar.",
    problema: "Digitar cada nota à mão é lento e propenso a erro, e papel acumulado vira bagunça na hora de fechar o mês.",
    beneficios: ["Valor, data, fornecedor e itens vêm preenchidos para você conferir.", "Cada item pode ir para um projeto ou para o Depósito, e a compra entra no estoque do destino."],
    passos: ["Abra Captura de documentos e tire a foto, ou carregue o arquivo (PNG, JPG ou WEBP).", "Clique em Usar esta foto e espere a leitura.", "Confira os dados. Em Destino de todos os itens, escolha o projeto ou o Depósito, e ajuste item a item se precisar.", "Salve: a conta entra em contas a pagar, com o vencimento."],
    exemplo: "Nota de R$ 1.200 com cimento e areia. Você manda parte para a obra da rua A e parte para o Depósito, e o valor da nota é dividido proporcionalmente entre os dois destinos.",
    acao: { rotulo: "Capturar um documento", href: "/capturar" },
  },
  contas_pagar: {
    chave: "contas_pagar",
    titulo: "Contas a pagar",
    oQueE: "A lista das suas despesas, com vencimento, fornecedor, projeto e situação, onde você lança, edita e dá baixa.",
    problema: "Sem um lugar só, vencimentos passam batido e fica difícil saber quanto cada projeto já custou.",
    beneficios: ["Você vê o que vence e o que está atrasado.", "Cada conta fica ligada a um projeto, então o custo de cada um se fecha sozinho."],
    passos: ["Clique em Nova conta.", "Preencha valor, vencimento, fornecedor e o projeto.", "Quando pagar, abra a conta e dê baixa.", "Use os filtros da lista (Buscar, Projeto, Status e Vencimento) para achar o que procura."],
    exemplo: "Boleto do fornecedor de tinta vence dia 15. Você lança a conta no projeto certo e, no dia do pagamento, dá baixa para sair da lista de abertas.",
    acao: { rotulo: "Lançar uma conta a pagar", href: "/contas-a-pagar" },
  },
  contas_receber: {
    chave: "contas_receber",
    titulo: "Contas a receber",
    oQueE: "A lista do que você tem a receber de clientes, com vencimento e situação, onde você lança, edita e dá baixa.",
    problema: "Cobrar na hora certa exige saber quem deve o quê e desde quando.",
    beneficios: ["Mostra o que já venceu e o que ainda vai entrar.", "Fica ligado ao projeto, ao lado das despesas dele."],
    passos: ["Clique em Nova conta.", "Informe o cliente, o valor, o vencimento e o projeto.", "Quando o cliente pagar, abra a conta e dê baixa.", "Acompanhe o que está atrasado pelos filtros de Status e Vencimento."],
    exemplo: "Medição de R$ 8.000 vence dia 30. Você lança a receita no projeto e, quando o dinheiro cai, dá baixa.",
    acao: { rotulo: "Lançar uma conta a receber", href: "/contas-a-receber" },
  },
  projetos: {
    chave: "projetos",
    titulo: "Projetos",
    oQueE: "O cadastro de cada obra ou serviço, com cliente, datas e orçamento, e o acompanhamento do custo e do que entrou nele.",
    problema: "Sem separar por projeto, as despesas ficam misturadas e não dá para saber se uma obra está dando resultado.",
    beneficios: ["As contas e os materiais de cada projeto ficam reunidos.", "Você compara o orçamento com o que já foi gasto."],
    passos: ["Clique em Novo projeto.", "Informe o nome, o cliente, as datas e o orçamento.", "Lance contas e materiais nesse projeto.", "Abra o projeto para ver o custo, as contas e os materiais vindos do Depósito."],
    exemplo: "Reforma da casa do Sr. João, orçamento de R$ 150.000. À medida que as compras são lançadas, o detalhe do projeto mostra o gasto e o saldo do orçamento.",
    acao: { rotulo: "Cadastrar um projeto", href: "/obras/novo" },
  },
  estoque: {
    chave: "estoque",
    titulo: "Estoque",
    oQueE: "Produtos e o saldo de cada um por local (cada projeto e o Depósito), com entradas, saídas e o valor da última compra.",
    problema: "Material comprado e esquecido, ou comprado duas vezes, é custo que passa despercebido.",
    beneficios: ["Você vê quanto há de cada material e onde está.", "O Depósito guarda o que ainda não tem projeto, e transferir dele para um projeto leva o custo junto, ao valor da última compra."],
    passos: ["Cadastre os produtos (ou deixe a Captura criá-los a partir das notas).", "Registre entradas e saídas de cada local.", "Em Depósito, veja os saldos e use Transferir para mandar material a um projeto.", "Consulte o histórico de movimentos de cada produto."],
    exemplo: "Você comprou 50 sacos de cimento para o Depósito. Quando 25 vão para a obra da rua A, a transferência passa o custo desses 25 para o projeto, sem gerar uma compra nova.",
    acao: { rotulo: "Abrir o estoque", href: "/estoque" },
  },
  funcionarios: {
    chave: "funcionarios",
    titulo: "Funcionários",
    oQueE: "O cadastro das pessoas da sua equipe e a alocação delas nos projetos.",
    problema: "Saber quem está em qual obra costuma ficar espalhado em listas e mensagens.",
    beneficios: ["Os dados de cada pessoa ficam num lugar só.", "A alocação mostra quem trabalha em cada projeto."],
    passos: ["Clique em Novo funcionário e preencha os dados.", "Aloque a pessoa nos projetos em que ela atua.", "Consulte a lista e use os filtros para achar uma pessoa."],
    exemplo: "Três pedreiros e um encarregado alocados na obra da rua A: ao abrir o projeto, você vê a equipe daquela obra.",
    acao: { rotulo: "Cadastrar um funcionário", href: "/funcionarios/novo" },
  },
  fornecedores: {
    chave: "fornecedores",
    titulo: "Fornecedores",
    oQueE: "O cadastro dos fornecedores, usado nas contas a pagar, na captura de notas e no estoque.",
    problema: "O mesmo fornecedor digitado de formas diferentes atrapalha qualquer busca e relatório.",
    beneficios: ["Escolher o fornecedor de uma lista evita nomes repetidos.", "Fica fácil ver tudo o que foi comprado de cada um."],
    passos: ["Abra Fornecedores e clique para adicionar um novo.", "Preencha o nome e os dados de contato.", "Ao lançar uma conta ou capturar uma nota, escolha o fornecedor da lista."],
    exemplo: "Depósito de materiais Silva cadastrado uma vez: todas as notas dele, lidas pela captura, ficam ligadas ao mesmo cadastro.",
    acao: { rotulo: "Abrir fornecedores", href: "/fornecedores" },
  },
  rede: {
    chave: "rede",
    titulo: "Elo Profissionais",
    oQueE: "A rede pública: seu perfil de empresa ou de profissional, com portfólio e avaliações, que outras pessoas encontram na busca.",
    problema: "Quem contrata procura alguém de confiança, e quem presta o serviço precisa ser encontrado.",
    beneficios: ["Seu perfil publicado aparece na busca por profissão e cidade.", "As avaliações vêm de quem de fato contratou você na plataforma."],
    passos: ["Abra o seu perfil e preencha o nome, a descrição, a cidade e o que você faz.", "Adicione trabalhos ao portfólio.", "Confirme o seu e-mail (necessário para publicar) e publique o perfil.", "Acompanhe avaliações e notificações em Minha rede."],
    exemplo: "Eletricista em Duque de Caxias publica o perfil com três trabalhos. Quem busca eletricista na cidade passa a ver o perfil nos resultados.",
    acao: { rotulo: "Completar meu perfil", href: "/minha-rede/perfil" },
  },
};

export const LISTA_DE_AJUDAS: readonly ConteudoAjuda[] = MODULOS.map((m) => AJUDAS[m.chave]);

/** A ajuda do módulo a que a rota pertence (o botão "Como funciona?" da tela); null em telas sem módulo. */
export function ajudaDaRota(pathname: string): ConteudoAjuda | null {
  const modulo = moduloDaRota(pathname);
  if (modulo === null || modulo === "cadastro") return null;
  return AJUDAS[modulo];
}

export function ehChaveDeAjuda(valor: unknown): valor is ModuloChave {
  return typeof valor === "string" && Object.hasOwn(AJUDAS, valor);
}

/** Ajudas que a pessoa pode ver: só de módulos que ela usa e que o plano da empresa inclui. */
export function ajudasDisponiveis(pessoa: AcessoDaPessoa, recursos: ReadonlySet<string>): ConteudoAjuda[] {
  return LISTA_DE_AJUDAS.filter((a) => {
    const modulo = MODULOS.find((m) => m.chave === a.chave);
    return modulo !== undefined && recursos.has(modulo.recurso) && temAlgumModulo(pessoa, [a.chave]);
  });
}
