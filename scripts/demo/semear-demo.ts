import { randomBytes, randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { PrismaClient, type Prisma } from "@prisma/client";
import { gerarHash } from "../../src/lib/auth/senha";
import { adicionarDias, dataLocal, instanteLocal, periodoDoCompromisso } from "../../src/lib/calendario/tempo";
import { gerarSlug, normalizarBusca } from "../../src/lib/rede/texto";
import { lerConfigDemo } from "./guarda.mjs";
import { comprovanteSvg } from "./recibo";

// Dados FICTÍCIOS de ponta a ponta para gravar vídeos de divulgação: uma construtora com projetos, contas, estoque,
// equipe, calendário e uma rede de parceiros com avaliações. Tudo inventado (nomes, CNPJs, valores, comentários).
//
// Só roda contra uma branch separada do Neon (DATABASE_URL_DEMO); a trava em guarda.mjs recusa o banco real.
// As datas são relativas a hoje, então o painel mostra "vence em 3 dias" e "atrasada" de verdade na hora da gravação.
// Rode de novo no dia da gravação com --recriar para renovar as datas (yarn demo:semear --recriar).
//
// Rodar: yarn demo:semear   (as credenciais de acesso saem em .demo-credenciais.txt, que o git ignora)

const FUSO = "America/Sao_Paulo";
const hoje = dataLocal(new Date(), FUSO);
const dia = (n: number) => adicionarDias(hoje, n);
const ts = (n: number, hora = "10:00") => instanteLocal(dia(n), hora, FUSO).toISOString();
const agora = new Date().toISOString();
const arred = (n: number) => Math.round(n * 100) / 100;

function urlDaDemo(): string {
  try {
    return lerConfigDemo().demo;
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
const cliente = new PrismaClient({ datasourceUrl: urlDaDemo() });

type Chave = string;
const ids = (chaves: readonly Chave[]) => Object.fromEntries(chaves.map((c) => [c, randomUUID()])) as Record<Chave, string>;

/** Tudo numa transação só: se algo falhar, nada fica gravado e dá para rodar de novo. */
/** Apaga só a empresa de demonstração e os parceiros fictícios (identificados pelos e-mails .test da demo). Roda apenas na branch separada. */
async function limparDemo(prisma: Prisma.TransactionClient): Promise<void> {
  const usuarios = await prisma.usuario.findMany({ where: { OR: [{ email: { endsWith: "@horizonte-demo.test" } }, { email: { endsWith: "@parceiro-demo.test" } }] }, select: { id: true, empresaId: true } });
  const empresas = [...new Set(usuarios.map((u) => u.empresaId))];
  const usuarioIds = usuarios.map((u) => u.id);
  if (empresas.length === 0) return;
  const perfis = (await prisma.perfilPublico.findMany({ where: { empresaId: { in: empresas } }, select: { id: true } })).map((x) => x.id);
  const contasIds = (await prisma.contaFinanceira.findMany({ where: { empresaId: { in: empresas } }, select: { id: true } })).map((x) => x.id);
  const avaliacoes = (await prisma.avaliacao.findMany({ where: { OR: [{ perfilId: { in: perfis } }, { avaliadorEmpresaId: { in: empresas } }] }, select: { id: true } })).map((x) => x.id);
  await prisma.respostaAvaliacao.deleteMany({ where: { avaliacaoId: { in: avaliacoes } } });
  await prisma.avaliacaoHistorico.deleteMany({ where: { avaliacaoId: { in: avaliacoes } } });
  await prisma.avaliacao.deleteMany({ where: { id: { in: avaliacoes } } });
  await prisma.indicacao.deleteMany({ where: { OR: [{ perfilId: { in: perfis } }, { indicadoPorEmpresaId: { in: empresas } }] } });
  await prisma.trabalho.deleteMany({ where: { perfilId: { in: perfis } } });
  await prisma.servico.deleteMany({ where: { perfilId: { in: perfis } } });
  await prisma.perfilProfissao.deleteMany({ where: { perfilId: { in: perfis } } });
  await prisma.perfilPublico.deleteMany({ where: { id: { in: perfis } } });
  await prisma.movimentoEstoque.deleteMany({ where: { empresaId: { in: empresas } } });
  await prisma.saldoEstoque.deleteMany({ where: { empresaId: { in: empresas } } });
  await prisma.rateioConta.deleteMany({ where: { contaFinanceiraId: { in: contasIds } } });
  await prisma.itemProduto.deleteMany({ where: { empresaId: { in: empresas } } });
  await prisma.contaFinanceira.deleteMany({ where: { empresaId: { in: empresas } } });
  await prisma.produto.deleteMany({ where: { empresaId: { in: empresas } } });
  await prisma.funcionario.deleteMany({ where: { empresaId: { in: empresas } } });
  await prisma.fornecedor.deleteMany({ where: { empresaId: { in: empresas } } });
  await prisma.obra.deleteMany({ where: { empresaId: { in: empresas } } });
  await prisma.compromisso.deleteMany({ where: { empresaId: { in: empresas } } });
  await prisma.notificacao.deleteMany({ where: { empresaId: { in: empresas } } });
  await prisma.sessao.deleteMany({ where: { usuarioId: { in: usuarioIds } } });
  await prisma.progressoOnboarding.deleteMany({ where: { usuarioId: { in: usuarioIds } } });
  await prisma.usuario.deleteMany({ where: { id: { in: usuarioIds } } });
  await prisma.empresa.deleteMany({ where: { id: { in: empresas } } });
}

async function main(prisma: Prisma.TransactionClient): Promise<{ credenciais: string[]; resumo: string }> {
  if (process.argv.includes("--recriar")) await limparDemo(prisma);
  if ((await prisma.empresa.count({ where: { documento: "11222333000181" } })) > 0) {
    throw new Error("A demonstração já existe nesta branch. Rode com --recriar para apagar a demonstração anterior e criar de novo.");
  }

  // ---------------------------------------------------------------- empresa e pessoas
  const empresaId = randomUUID();
  await prisma.empresa.create({
    data: {
      id: empresaId,
      documento: "11222333000181",
      razaoSocial: "Horizonte Reformas e Construções Ltda",
      nomeFantasia: "Horizonte Reformas",
      tipoPessoa: "pj",
      plano: "ativo",
      telefone: "2130000100",
      emailContato: "contato@horizonte-demo.test",
      cep: "20040020",
      logradouro: "Rua da Assembleia",
      numero: "100",
      bairro: "Centro",
      cidade: "Rio de Janeiro",
      estado: "RJ",
      aceiteTermosVersao: "demo",
      aceiteTermosEm: agora,
      criadoEm: ts(-120),
      atualizadoEm: agora,
    },
  });

  const credenciais: string[] = [];
  async function criarUsuario(chave: string, nome: string, email: string, papel: "dono" | "membro", modulos: string[]): Promise<string> {
    const senha = randomBytes(9).toString("base64url") + "A1!";
    const id = randomUUID();
    await prisma.usuario.create({
      data: { id, empresaId, nome, email, senhaHash: await gerarHash(senha), papel, modulos, emailConfirmadoEm: ts(-119), emailsPromocionais: false, lembretesPorEmail: false, criadoEm: ts(-119), atualizadoEm: agora },
    });
    await prisma.progressoOnboarding.create({
      data: { usuarioId: id, tourEstado: "concluido", tourPasso: 3, checklistOcultoEm: ts(-100), ajudasVistas: [], criadoEm: ts(-119), atualizadoEm: agora },
    });
    credenciais.push(`${papel === "dono" ? "DONO   " : "MEMBRO "} ${nome.padEnd(18)} ${email.padEnd(34)} ${senha}`);
    return id;
  }
  const marina = await criarUsuario("marina", "Marina Albuquerque", "marina@horizonte-demo.test", "dono", []);
  const rafael = await criarUsuario("rafael", "Rafael Costa", "rafael@horizonte-demo.test", "membro", ["estoque", "projetos", "calendario", "funcionarios"]);
  const juliana = await criarUsuario("juliana", "Juliana Prado", "juliana@horizonte-demo.test", "membro", ["dashboard", "contas_pagar", "contas_receber", "fornecedores", "captura", "calendario"]);

  // ---------------------------------------------------------------- projetos
  const O = ids(["vila", "jardim", "galpao", "loja", "geral", "dep"]);
  const obras = [
    { id: O.vila!, nome: "Reforma Residencial Vila Nova", cliente: "Família Albuquerque Neves", endereco: "Rua das Palmeiras, 240, Tijuca, Rio de Janeiro", status: "em_andamento", inicio: -75, fim: null, orcamento: 185000, obs: "Reforma completa: elétrica, hidráulica, revestimentos e pintura." },
    { id: O.jardim!, nome: "Fachada Edifício Jardim das Acácias", cliente: "Condomínio Jardim das Acácias", endereco: "Av. Atlântica, 1800, Copacabana, Rio de Janeiro", status: "em_andamento", inicio: -45, fim: null, orcamento: 420000, obs: "Recuperação de fachada, impermeabilização e pintura. Entrega em etapas por torre." },
    { id: O.galpao!, nome: "Galpão Logístico Distrito Norte", cliente: "Norte Log Armazéns Ltda", endereco: "Rod. Washington Luiz, km 12, Duque de Caxias", status: "pausada", inicio: -150, fim: null, orcamento: 310000, obs: "Pausado aguardando liberação de licença do cliente." },
    { id: O.loja!, nome: "Loja Conceito Shopping Central", cliente: "Conceito Moda e Casa", endereco: "Shopping Central, loja 214, Barra da Tijuca", status: "concluida", inicio: -210, fim: -40, orcamento: 98000, obs: "Projeto entregue dentro do prazo." },
    { id: O.geral!, nome: "Despesas Gerais da Empresa", cliente: "Interno", endereco: null, status: "em_andamento", inicio: -120, fim: null, orcamento: null, obs: "Aluguel, veículos e custos que não pertencem a um projeto." },
  ] as const;
  for (const o of obras) {
    await prisma.obra.create({
      data: { id: o.id, empresaId, nome: o.nome, cliente: o.cliente, endereco: o.endereco, status: o.status, dataInicio: dia(o.inicio), dataFim: o.fim === null ? null : dia(o.fim), orcamentoPrevisto: o.orcamento, observacoes: o.obs, criadoEm: ts(o.inicio), atualizadoEm: agora },
    });
  }
  await prisma.obra.create({
    data: { id: O.dep!, empresaId, nome: "Depósito", cliente: "Interno", status: "em_andamento", dataInicio: dia(-120), ehDeposito: true, criadoEm: ts(-120), atualizadoEm: agora },
  });

  // ---------------------------------------------------------------- fornecedores e equipe
  const F = ids(["casa", "aco", "eletrica", "concreto", "locadora", "frete", "tintas", "escritorio"]);
  const fornecedores = [
    { k: "casa", nome: "Casa do Construtor Materiais", doc: "30000000000011", tel: "2133330001", cidade: "Rio de Janeiro" },
    { k: "aco", nome: "Aço Forte Distribuidora", doc: "30000000000022", tel: "2133330002", cidade: "Duque de Caxias" },
    { k: "eletrica", nome: "Elétrica Luz & Cia", doc: "30000000000033", tel: "2133330003", cidade: "Rio de Janeiro" },
    { k: "concreto", nome: "Concreto Sul Usinas", doc: "30000000000044", tel: "2133330004", cidade: "Niterói" },
    { k: "locadora", nome: "Locadora de Equipamentos Beta", doc: "30000000000055", tel: "2133330005", cidade: "Rio de Janeiro" },
    { k: "frete", nome: "Transportes Rápido Fretes", doc: "30000000000066", tel: "2133330006", cidade: "Rio de Janeiro" },
    { k: "tintas", nome: "Tintas Colorama", doc: "30000000000077", tel: "2133330007", cidade: "Rio de Janeiro" },
    { k: "escritorio", nome: "Imobiliária Centro Empresarial", doc: "30000000000088", tel: "2133330008", cidade: "Rio de Janeiro" },
  ] as const;
  for (const f of fornecedores) {
    await prisma.fornecedor.create({
      data: { id: F[f.k]!, empresaId, nome: f.nome, documento: f.doc, telefone: f.tel, email: `vendas@${gerarSlug(f.nome)}.test`, cidade: f.cidade, estado: "RJ", criadoEm: ts(-110), atualizadoEm: agora },
    });
  }
  const funcionarios = [
    { nome: "Carlos Eduardo Lima", cargo: "Mestre de obras", obra: O.vila!, salario: 5200, adm: -300 },
    { nome: "Rogério Santana", cargo: "Pedreiro", obra: O.vila!, salario: 3100, adm: -260 },
    { nome: "Anderson Pires", cargo: "Eletricista", obra: O.vila!, salario: 3600, adm: -180 },
    { nome: "Patrícia Moreira", cargo: "Engenheira civil", obra: O.jardim!, salario: 9800, adm: -400 },
    { nome: "Wellington Barros", cargo: "Encarregado", obra: O.jardim!, salario: 4300, adm: -220 },
    { nome: "Josué Ferreira", cargo: "Pintor", obra: O.jardim!, salario: 2900, adm: -90 },
    { nome: "Rafael Costa", cargo: "Almoxarife", obra: null, salario: 2800, adm: -119 },
    { nome: "Juliana Prado", cargo: "Auxiliar administrativo", obra: null, salario: 3200, adm: -119 },
  ] as const;
  for (const [i, f] of funcionarios.entries()) {
    await prisma.funcionario.create({
      data: { empresaId, nome: f.nome, cargo: f.cargo, telefone: `2199999${String(1000 + i)}`, email: `${gerarSlug(f.nome)}@horizonte-demo.test`, dataAdmissao: dia(f.adm), obraId: f.obra, salario: f.salario, criadoEm: ts(f.adm), atualizadoEm: agora },
    });
  }

  // ---------------------------------------------------------------- produtos e estoque
  const P = ids(["cimento", "areia", "brita", "tijolo", "vergalhao", "fio", "disjuntor", "tinta", "argamassa", "porcelanato", "tubo", "cal", "prego", "luva"]);
  const produtos = [
    { k: "cimento", nome: "Cimento CP-II 50 kg", sku: "CIM-50", cat: "Aglomerantes", un: "saco", min: 40 },
    { k: "areia", nome: "Areia média lavada", sku: "ARE-M", cat: "Agregados", un: "m³", min: 6 },
    { k: "brita", nome: "Brita 1", sku: "BRI-1", cat: "Agregados", un: "m³", min: 4 },
    { k: "tijolo", nome: "Tijolo cerâmico 8 furos", sku: "TIJ-8F", cat: "Alvenaria", un: "un", min: 1500 },
    { k: "vergalhao", nome: "Vergalhão CA-50 10 mm", sku: "VER-10", cat: "Estrutura", un: "barra", min: 60 },
    { k: "fio", nome: "Fio flexível 2,5 mm (rolo 100 m)", sku: "FIO-25", cat: "Elétrica", un: "rolo", min: 4 },
    { k: "disjuntor", nome: "Disjuntor monopolar 20 A", sku: "DIS-20", cat: "Elétrica", un: "un", min: 12 },
    { k: "tinta", nome: "Tinta acrílica fosca 18 L", sku: "TIN-18", cat: "Pintura", un: "lata", min: 10 },
    { k: "argamassa", nome: "Argamassa AC-II 20 kg", sku: "ARG-II", cat: "Revestimento", un: "saco", min: 30 },
    { k: "porcelanato", nome: "Porcelanato 80x80 acetinado", sku: "POR-80", cat: "Revestimento", un: "m²", min: 20 },
    { k: "tubo", nome: "Tubo PVC esgoto 100 mm", sku: "TUB-100", cat: "Hidráulica", un: "barra", min: 10 },
    { k: "cal", nome: "Cal hidratada 20 kg", sku: "CAL-20", cat: "Aglomerantes", un: "saco", min: 15 },
    { k: "prego", nome: "Prego 18x27 (kg)", sku: "PRE-1827", cat: "Ferragens", un: "kg", min: 5 },
    { k: "luva", nome: "Luva de segurança", sku: "EPI-LUV", cat: "EPI", un: "par", min: 20 },
  ] as const;
  const produtoPorChave = new Map<string, (typeof produtos)[number]>(produtos.map((p) => [p.k, p]));

  // Os produtos existem antes das notas: os itens de cada nota apontam para eles. O custo médio entra depois, quando as entradas são conhecidas.
  for (const p of produtos) {
    await prisma.produto.create({
      data: { id: P[p.k]!, empresaId, nome: p.nome, sku: p.sku, categoria: p.cat, unidade: p.un, estoqueMinimo: p.min, criadoEm: ts(-110), atualizadoEm: agora },
    });
  }

  // ---------------------------------------------------------------- contas (com notas fiscais, itens e rateio)
  type Forma = "pix" | "boleto" | "cartao_credito" | "transferencia" | "dinheiro";
  interface ContaDef {
    tipo: "pagar" | "receber";
    obra: string;
    forn?: string;
    /** Nome exibido quando não há fornecedor cadastrado. */
    fav?: string;
    desc: string;
    cat: string;
    valor: number;
    venc: number;
    paga?: boolean;
    forma: Forma;
    parcela?: { grupo: string; n: number; total: number };
    nf?: { numero: string; itens: { prod: string; qtd: number; unit: number; obra: string }[] };
  }
  const contas: ContaDef[] = [
    // Notas fiscais (viram itens de produto e estoque)
    { tipo: "pagar", obra: "vila", forn: "casa", desc: "Materiais de alvenaria e argamassa", cat: "custo_produtos", valor: 0, venc: -52, paga: true, forma: "boleto", nf: { numero: "000412", itens: [{ prod: "cimento", qtd: 60, unit: 38.9, obra: "vila" }, { prod: "argamassa", qtd: 40, unit: 24.5, obra: "vila" }, { prod: "areia", qtd: 12, unit: 135, obra: "vila" }, { prod: "tijolo", qtd: 4000, unit: 1.18, obra: "vila" }] } },
    { tipo: "pagar", obra: "jardim", forn: "aco", desc: "Vergalhões para recuperação estrutural", cat: "custo_produtos", valor: 0, venc: -30, paga: true, forma: "transferencia", nf: { numero: "008877", itens: [{ prod: "vergalhao", qtd: 150, unit: 52.8, obra: "jardim" }, { prod: "prego", qtd: 12, unit: 18.9, obra: "jardim" }] } },
    { tipo: "pagar", obra: "vila", forn: "eletrica", desc: "Fios e disjuntores da reforma elétrica", cat: "custo_produtos", valor: 0, venc: -20, paga: true, forma: "pix", nf: { numero: "002156", itens: [{ prod: "fio", qtd: 8, unit: 289.9, obra: "vila" }, { prod: "disjuntor", qtd: 24, unit: 18.7, obra: "vila" }] } },
    { tipo: "pagar", obra: "dep", forn: "tintas", desc: "Tintas para os projetos Vila Nova e Jardim (rateada)", cat: "custo_produtos", valor: 0, venc: -9, paga: true, forma: "boleto", nf: { numero: "014590", itens: [{ prod: "tinta", qtd: 12, unit: 389, obra: "dep" }, { prod: "tinta", qtd: 10, unit: 389, obra: "jardim" }, { prod: "tinta", qtd: 8, unit: 389, obra: "vila" }] } },
    { tipo: "pagar", obra: "jardim", forn: "casa", desc: "Porcelanato e argamassa colante do hall", cat: "custo_produtos", valor: 0, venc: 6, forma: "boleto", nf: { numero: "000431", itens: [{ prod: "porcelanato", qtd: 120, unit: 94.9, obra: "jardim" }, { prod: "argamassa", qtd: 60, unit: 24.5, obra: "jardim" }, { prod: "cal", qtd: 30, unit: 21.9, obra: "dep" }] } },
    { tipo: "pagar", obra: "dep", forn: "casa", desc: "Reposição do depósito: tubos, brita e luvas", cat: "custo_produtos", valor: 0, venc: 3, forma: "boleto", nf: { numero: "000440", itens: [{ prod: "tubo", qtd: 30, unit: 62.4, obra: "dep" }, { prod: "brita", qtd: 10, unit: 128, obra: "dep" }, { prod: "luva", qtd: 40, unit: 9.9, obra: "dep" }] } },
    // Demais contas a pagar
    { tipo: "pagar", obra: "geral", forn: "escritorio", desc: "Aluguel do escritório (mês anterior)", cat: "aluguel", valor: 4800, venc: -22, paga: true, forma: "boleto" },
    { tipo: "pagar", obra: "geral", forn: "escritorio", desc: "Aluguel do escritório (mês atual)", cat: "aluguel", valor: 4800, venc: 8, forma: "boleto" },
    { tipo: "pagar", obra: "jardim", forn: "locadora", desc: "Locação de andaime fachadeiro (mês 1)", cat: "aluguel_equipamentos", valor: 7350, venc: -26, paga: true, forma: "pix" },
    { tipo: "pagar", obra: "jardim", forn: "locadora", desc: "Locação de andaime fachadeiro (mês 2)", cat: "aluguel_equipamentos", valor: 7350, venc: -2, forma: "pix" },
    { tipo: "pagar", obra: "jardim", forn: "locadora", desc: "Locação de andaime fachadeiro (mês 3)", cat: "aluguel_equipamentos", valor: 7350, venc: 28, forma: "pix" },
    { tipo: "pagar", obra: "vila", forn: "concreto", desc: "Concreto usinado para laje da varanda", cat: "custo_produtos", valor: 6420, venc: -38, paga: true, forma: "transferencia" },
    { tipo: "pagar", obra: "vila", forn: "frete", desc: "Frete de entulho e retirada de caçambas", cat: "fretes", valor: 1380, venc: -12, paga: true, forma: "pix" },
    { tipo: "pagar", obra: "jardim", forn: "frete", desc: "Frete de materiais para a torre B", cat: "fretes", valor: 920, venc: -5, forma: "pix" },
    { tipo: "pagar", obra: "geral", fav: "Oficina Mecânica Central", desc: "Manutenção da caminhonete de obra", cat: "manutencao_veiculos", valor: 1860, venc: -9, forma: "cartao_credito" },
    { tipo: "pagar", obra: "geral", fav: "Posto Rota 116", desc: "Combustível e pedágios da equipe", cat: "custo_transporte", valor: 2240, venc: 1, forma: "cartao_credito" },
    { tipo: "pagar", obra: "vila", fav: "Folha de pagamento", desc: "Folha dos funcionários da obra (quinzena)", cat: "custo_funcionario", valor: 11900, venc: 5, forma: "transferencia" },
    { tipo: "pagar", obra: "jardim", fav: "Folha de pagamento", desc: "Folha dos funcionários da obra (quinzena)", cat: "custo_funcionario", valor: 17400, venc: 5, forma: "transferencia" },
    { tipo: "pagar", obra: "jardim", forn: "casa", desc: "Revestimento da fachada (3 parcelas)", cat: "custo_produtos", valor: 5400, venc: -1, paga: true, forma: "boleto", parcela: { grupo: "fachada", n: 1, total: 3 } },
    { tipo: "pagar", obra: "jardim", forn: "casa", desc: "Revestimento da fachada (3 parcelas)", cat: "custo_produtos", valor: 5400, venc: 29, forma: "boleto", parcela: { grupo: "fachada", n: 2, total: 3 } },
    { tipo: "pagar", obra: "jardim", forn: "casa", desc: "Revestimento da fachada (3 parcelas)", cat: "custo_produtos", valor: 5400, venc: 59, forma: "boleto", parcela: { grupo: "fachada", n: 3, total: 3 } },
    { tipo: "pagar", obra: "loja", forn: "tintas", desc: "Acabamento final da loja", cat: "custo_produtos", valor: 3980, venc: -62, paga: true, forma: "boleto" },
    { tipo: "pagar", obra: "galpao", forn: "locadora", desc: "Retirada de equipamentos do canteiro pausado", cat: "aluguel_equipamentos", valor: 2150, venc: 12, forma: "pix" },
    // Histórico mais antigo (a Loja Conceito e o início da Vila Nova), para o gráfico ter movimento nos meses anteriores
    { tipo: "pagar", obra: "loja", forn: "casa", desc: "Revestimentos e louças da loja", cat: "custo_produtos", valor: 11800, venc: -96, paga: true, forma: "boleto" },
    { tipo: "pagar", obra: "loja", fav: "Equipe terceirizada Prado", desc: "Mão de obra terceirizada · loja", cat: "custo_funcionario", valor: 8600, venc: -80, paga: true, forma: "transferencia" },
    { tipo: "pagar", obra: "loja", forn: "locadora", desc: "Locação de equipamentos · loja", cat: "aluguel_equipamentos", valor: 3150, venc: -70, paga: true, forma: "pix" },
    { tipo: "pagar", obra: "vila", forn: "frete", desc: "Demolição e retirada de entulho", cat: "fretes", valor: 2100, venc: -68, paga: true, forma: "pix" },
    { tipo: "pagar", obra: "galpao", forn: "concreto", desc: "Fundação do galpão (etapa 1)", cat: "custo_produtos", valor: 18900, venc: -118, paga: true, forma: "transferencia" },
    { tipo: "receber", obra: "loja", desc: "Medição 1 · Loja Conceito", cat: "obras", valor: 34300, venc: -105, paga: true, forma: "pix" },
    { tipo: "receber", obra: "loja", desc: "Medição 2 · Loja Conceito", cat: "obras", valor: 34300, venc: -75, paga: true, forma: "pix" },
    // Contas a receber
    { tipo: "receber", obra: "vila", desc: "Medição 1 · Reforma Vila Nova", cat: "obras", valor: 46250, venc: -48, paga: true, forma: "pix" },
    { tipo: "receber", obra: "vila", desc: "Medição 2 · Reforma Vila Nova", cat: "obras", valor: 46250, venc: -14, paga: true, forma: "pix" },
    { tipo: "receber", obra: "vila", desc: "Medição 3 · Reforma Vila Nova", cat: "obras", valor: 46250, venc: 7, forma: "pix" },
    { tipo: "receber", obra: "jardim", desc: "Medição 1 · Fachada Jardim das Acácias", cat: "obras", valor: 84000, venc: -18, paga: true, forma: "transferencia" },
    { tipo: "receber", obra: "jardim", desc: "Medição 2 · Fachada Jardim das Acácias", cat: "obras", valor: 84000, venc: 11, forma: "transferencia" },
    { tipo: "receber", obra: "jardim", desc: "Medição 3 · Fachada Jardim das Acácias", cat: "obras", valor: 84000, venc: 41, forma: "transferencia" },
    { tipo: "receber", obra: "loja", desc: "Parcela final · Loja Conceito", cat: "obras", valor: 29400, venc: -41, paga: true, forma: "pix" },
    { tipo: "receber", obra: "galpao", desc: "Entrada do contrato · Galpão Logístico", cat: "obras", valor: 62000, venc: -140, paga: true, forma: "transferencia" },
    { tipo: "receber", obra: "geral", fav: "Cliente avulso (manutenção)", desc: "Manutenção preventiva · cliente avulso", cat: "manutencao", valor: 3600, venc: -4, forma: "pix" },
  ];

  const obraPorChave = (k: string) => (O as Record<string, string>)[k]!;
  const nomeDaObra = (k: string) => obras.find((o) => o.id === obraPorChave(k))?.cliente ?? "Interno";
  const nomeUsuario = ["Juliana Prado", "Marina Albuquerque"];
  const parcelamentos = new Map<string, string>();
  const entradasPorProduto = new Map<string, { qtd: number; total: number }>();
  const movimentos: { id: string; produto: string; obra: string; tipo: "entrada" | "saida"; qtd: number; unit: number | null; origem: string; itemId?: string; quem: string; obs?: string; quando: string; transferenciaId?: string }[] = [];

  for (const [i, c] of contas.entries()) {
    const idConta = randomUUID();
    const itens = c.nf?.itens ?? [];
    const valor = c.nf ? arred(itens.reduce((s, it) => s + it.qtd * it.unit, 0)) : c.valor;
    const lanc = Math.min(c.venc - 14, -1);
    const baixa = c.paga ? Math.min(c.venc, -1) : null;
    const emissor = c.fav ?? (c.tipo === "pagar" ? fornecedores.find((f) => F[f.k] === F[c.forn!])!.nome : nomeDaObra(c.obra));
    const pessoa = nomeUsuario[i % 2]!;
    const comprovante = comprovanteSvg({
      titulo: c.nf ? "NOTA FISCAL" : "RECIBO",
      emissor: c.tipo === "pagar" ? emissor : "Horizonte Reformas",
      numero: c.nf?.numero ?? String(1000 + i),
      data: dia(lanc).split("-").reverse().join("/"),
      linhas: c.nf ? itens.map((it) => ({ descricao: `${it.qtd} ${produtoPorChave.get(it.prod)!.un} · ${produtoPorChave.get(it.prod)!.nome}`, valor: arred(it.qtd * it.unit) })) : [{ descricao: c.desc, valor }],
      total: valor,
    });
    const parcelamentoId = c.parcela ? (parcelamentos.get(c.parcela.grupo) ?? (parcelamentos.set(c.parcela.grupo, randomUUID()), parcelamentos.get(c.parcela.grupo)!)) : null;
    const rateada = c.nf && new Set(itens.map((it) => it.obra)).size > 1;

    await prisma.contaFinanceira.create({
      data: {
        id: idConta,
        empresaId,
        tipo: c.tipo,
        obraId: obraPorChave(c.obra),
        valor,
        dataLancamento: dia(lanc),
        dataVencimento: dia(c.venc),
        dataBaixa: baixa === null ? null : dia(baixa),
        status: c.paga ? "baixada" : "em_aberto",
        favorecidoOuCliente: emissor,
        fornecedorId: c.forn ? F[c.forn]! : null,
        descricao: c.desc,
        categoria: c.cat,
        formaPagamento: c.forma,
        comprovanteUrl: comprovante,
        origemNotaFiscal: !!c.nf,
        notaFiscalId: c.nf?.numero ?? null,
        parcelamentoId,
        parcelaNumero: c.parcela?.n ?? null,
        parcelaTotal: c.parcela?.total ?? null,
        historico: [
          { id: randomUUID(), tipo: "criacao", usuario: pessoa, data: ts(lanc, "09:15") },
          ...(c.paga && baixa !== null ? [{ id: randomUUID(), tipo: "baixa", usuario: pessoa, data: ts(baixa, "16:40"), detalhes: `Baixa por ${c.forma}` }] : []),
        ],
        criadoEm: ts(lanc, "09:15"),
        atualizadoEm: ts(baixa ?? lanc, "16:40"),
      },
    });

    if (rateada) {
      const porObra = new Map<string, number>();
      for (const it of itens) porObra.set(it.obra, arred((porObra.get(it.obra) ?? 0) + it.qtd * it.unit));
      for (const [obra, v] of porObra) await prisma.rateioConta.create({ data: { contaFinanceiraId: idConta, obraId: obraPorChave(obra), valor: v } });
    }
    for (const it of itens) {
      const idItem = randomUUID();
      const p = produtoPorChave.get(it.prod)!;
      await prisma.itemProduto.create({
        data: { id: idItem, empresaId, contaFinanceiraId: idConta, obraId: obraPorChave(it.obra), produtoId: P[it.prod]!, descricao: p.nome, quantidade: it.qtd, unidade: p.un, valorUnitario: it.unit, valorTotal: arred(it.qtd * it.unit), dataCompra: dia(lanc), fornecedor: emissor, criadoEm: ts(lanc, "09:20") },
      });
      movimentos.push({ id: randomUUID(), produto: it.prod, obra: it.obra, tipo: "entrada", qtd: it.qtd, unit: it.unit, origem: "item_produto", itemId: idItem, quem: pessoa, quando: ts(lanc, "09:20") });
      const e = entradasPorProduto.get(it.prod) ?? { qtd: 0, total: 0 };
      entradasPorProduto.set(it.prod, { qtd: e.qtd + it.qtd, total: e.total + it.qtd * it.unit });
    }
  }

  // Entradas manuais (produtos sem nota no período) e consumo/transferências, em ordem cronológica.
  const trf = randomUUID();
  const manuais: typeof movimentos = [
    { id: randomUUID(), produto: "prego", obra: "dep", tipo: "entrada", qtd: 20, unit: 18.5, origem: "manual", quem: "Rafael Costa", quando: ts(-100, "08:30") },
    { id: randomUUID(), produto: "luva", obra: "dep", tipo: "entrada", qtd: 60, unit: 9.5, origem: "manual", quem: "Rafael Costa", quando: ts(-100, "08:35") },
    { id: randomUUID(), produto: "cimento", obra: "dep", tipo: "entrada", qtd: 50, unit: 37.8, origem: "manual", quem: "Rafael Costa", quando: ts(-90, "08:40") },
    { id: randomUUID(), produto: "cal", obra: "dep", tipo: "entrada", qtd: 12, unit: 21.5, origem: "manual", quem: "Rafael Costa", quando: ts(-90, "08:45") },
    { id: randomUUID(), produto: "cimento", obra: "vila", tipo: "saida", qtd: 38, unit: null, origem: "manual", quem: "Rafael Costa", obs: "Contrapiso da sala e cozinha", quando: ts(-40, "07:50") },
    { id: randomUUID(), produto: "argamassa", obra: "vila", tipo: "saida", qtd: 28, unit: null, origem: "manual", quem: "Rafael Costa", obs: "Assentamento de revestimento", quando: ts(-33, "07:55") },
    { id: randomUUID(), produto: "tijolo", obra: "vila", tipo: "saida", qtd: 3200, unit: null, origem: "manual", quem: "Rafael Costa", obs: "Fechamento da parede da varanda", quando: ts(-44, "07:45") },
    { id: randomUUID(), produto: "vergalhao", obra: "jardim", tipo: "saida", qtd: 96, unit: null, origem: "manual", quem: "Rafael Costa", obs: "Reforço estrutural da marquise", quando: ts(-22, "08:05") },
    { id: randomUUID(), produto: "areia", obra: "vila", tipo: "saida", qtd: 8, unit: null, origem: "manual", quem: "Rafael Costa", obs: "Reboco interno", quando: ts(-36, "08:00") },
    { id: randomUUID(), produto: "fio", obra: "vila", tipo: "saida", qtd: 6, unit: null, origem: "manual", quem: "Anderson Pires", obs: "Passagem de fiação dos quartos", quando: ts(-15, "08:10") },
    { id: randomUUID(), produto: "tinta", obra: "dep", tipo: "saida", qtd: 4, unit: null, origem: "transferencia", quem: "Rafael Costa", obs: "Transferência para Reforma Vila Nova", quando: ts(-6, "08:20"), transferenciaId: trf },
    { id: randomUUID(), produto: "tinta", obra: "vila", tipo: "entrada", qtd: 4, unit: 389, origem: "transferencia", quem: "Rafael Costa", obs: "Transferência do Depósito", quando: ts(-6, "08:20"), transferenciaId: trf },
    { id: randomUUID(), produto: "tinta", obra: "jardim", tipo: "saida", qtd: 7, unit: null, origem: "manual", quem: "Rafael Costa", obs: "Primeira demão do hall", quando: ts(-4, "08:10") },
    { id: randomUUID(), produto: "luva", obra: "dep", tipo: "saida", qtd: 46, unit: null, origem: "manual", quem: "Rafael Costa", obs: "Entrega de EPIs para as equipes", quando: ts(-18, "07:40") },
  ];
  for (const m of manuais) {
    if (m.tipo === "entrada" && m.unit !== null && m.origem === "manual") {
      const e = entradasPorProduto.get(m.produto) ?? { qtd: 0, total: 0 };
      entradasPorProduto.set(m.produto, { qtd: e.qtd + m.qtd, total: e.total + m.qtd * m.unit });
    }
  }
  const todos = [...movimentos, ...manuais].sort((a, b) => a.quando.localeCompare(b.quando));

  // Saldos: soma em ordem cronológica e confere que nenhum local fica negativo (a demo nunca mostra estoque impossível).
  const saldos = new Map<string, number>();
  for (const m of todos) {
    const chave = `${m.produto}|${m.obra}`;
    const novo = (saldos.get(chave) ?? 0) + (m.tipo === "entrada" ? m.qtd : -m.qtd);
    if (novo < 0) throw new Error(`Estoque negativo na demo: ${m.produto} em ${m.obra}. Ajuste os movimentos.`);
    saldos.set(chave, novo);
  }
  for (const p of produtos) {
    const e = entradasPorProduto.get(p.k);
    if (e) await prisma.produto.update({ where: { id: P[p.k]! }, data: { custoMedio: arred(e.total / e.qtd) } });
  }
  for (const [chave, quantidade] of saldos) {
    const [produto, obra] = chave.split("|") as [string, string];
    await prisma.saldoEstoque.create({ data: { empresaId, produtoId: P[produto]!, obraId: obraPorChave(obra), quantidade, atualizadoEm: agora } });
  }
  for (const m of todos) {
    await prisma.movimentoEstoque.create({
      data: { id: m.id, empresaId, produtoId: P[m.produto]!, obraId: obraPorChave(m.obra), tipo: m.tipo, quantidade: m.qtd, valorUnitario: m.unit, origem: m.origem, itemProdutoId: m.itemId ?? null, lancadoPor: m.quem, observacao: m.obs ?? null, criadoEm: m.quando, transferenciaId: m.transferenciaId ?? null },
    });
  }

  // ---------------------------------------------------------------- calendário
  const compromissos: { titulo: string; desc: string; cat: "reuniao" | "visita" | "prazo" | "financeiro" | "outro"; dia: number; ini?: string; fim?: string; inteiro?: boolean; por: string; com: string[]; status?: "agendado" | "concluido" | "cancelado" }[] = [
    { titulo: "Visita técnica · Jardim das Acácias (torre B)", desc: "Conferir andaimes e medir a área do segundo pavimento.", cat: "visita", dia: 0, ini: "14:00", fim: "15:30", por: marina, com: [rafael] },
    { titulo: "Reunião de alinhamento com o síndico", desc: "Apresentar o cronograma da torre B e a medição 2.", cat: "reuniao", dia: 1, ini: "10:00", fim: "11:00", por: marina, com: [juliana] },
    { titulo: "Vencimento: folha da quinzena", desc: "Conferir saldo antes da transferência.", cat: "financeiro", dia: 5, inteiro: true, por: juliana, com: [marina] },
    { titulo: "Entrega do porcelanato do hall", desc: "Casa do Construtor entrega a partir das 8h. Receber e conferir caixas.", cat: "prazo", dia: 3, ini: "08:00", fim: "09:00", por: rafael, com: [marina] },
    { titulo: "Vistoria final · Reforma Vila Nova (etapa elétrica)", desc: "Teste dos quadros com o eletricista.", cat: "visita", dia: 4, ini: "09:30", fim: "11:00", por: marina, com: [rafael] },
    { titulo: "Cobrança: medição 3 da Família Albuquerque", desc: "Enviar a medição e o comprovante dos serviços.", cat: "financeiro", dia: 7, inteiro: true, por: marina, com: [juliana] },
    { titulo: "Orçamento do condomínio Bela Vista", desc: "Levantamento de medidas para proposta de pintura.", cat: "visita", dia: 9, ini: "15:00", fim: "16:30", por: marina, com: [] },
    { titulo: "Treinamento de segurança da equipe", desc: "Uso de EPIs e trabalho em altura.", cat: "reuniao", dia: 12, ini: "08:00", fim: "10:00", por: rafael, com: [marina] },
    { titulo: "Prazo: entrega da primeira etapa da fachada", desc: "Entrega parcial combinada com o condomínio.", cat: "prazo", dia: 20, inteiro: true, por: marina, com: [rafael, juliana] },
    { titulo: "Reunião com o cliente · Galpão Distrito Norte", desc: "Retomada da obra após liberação da licença.", cat: "reuniao", dia: 14, ini: "11:00", fim: "12:00", por: marina, com: [] },
    { titulo: "Visita ao fornecedor de esquadrias", desc: "Escolher modelos para a loja do shopping.", cat: "visita", dia: -3, ini: "10:00", fim: "11:30", por: marina, com: [], status: "concluido" },
    { titulo: "Reunião semanal da equipe", desc: "Pendências de materiais e prioridades da semana.", cat: "reuniao", dia: -2, ini: "08:30", fim: "09:15", por: marina, com: [rafael, juliana], status: "concluido" },
    { titulo: "Fechamento do mês: conferir notas e baixas", desc: "Separar notas pendentes de lançamento.", cat: "financeiro", dia: -7, inteiro: true, por: juliana, com: [marina], status: "concluido" },
    { titulo: "Visita cancelada · cliente reagendou", desc: "Cliente pediu para remarcar para a próxima semana.", cat: "visita", dia: -1, ini: "16:00", fim: "17:00", por: marina, com: [], status: "cancelado" },
  ];
  for (const c of compromissos) {
    const data = dia(c.dia);
    const periodo = periodoDoCompromisso({ data, diaInteiro: !!c.inteiro, horaInicio: c.ini, horaFim: c.fim }, FUSO);
    const id = randomUUID();
    await prisma.compromisso.create({
      data: { id, empresaId, criadoPorId: c.por, titulo: c.titulo, descricao: c.desc, categoria: c.cat, status: c.status ?? "agendado", data, diaInteiro: !!c.inteiro, horaInicio: c.inteiro ? null : (c.ini ?? null), horaFim: c.inteiro ? null : (c.fim ?? null), fuso: FUSO, inicioEm: periodo.inicioEm, fimEm: periodo.fimEm, criadoEm: ts(-5), atualizadoEm: agora },
    });
    for (const u of c.com) await prisma.compromissoParticipante.create({ data: { compromissoId: id, usuarioId: u, criadoEm: ts(-5) } });
  }
  await prisma.notificacao.createMany({
    data: [
      { empresaId, usuarioId: marina, tipo: "lembrete", titulo: "Hoje às 14:00", texto: "Visita técnica · Jardim das Acácias (torre B)", href: "/calendario", lida: false, criadoEm: ts(0, "07:00") },
      { empresaId, usuarioId: marina, tipo: "lembrete", titulo: "Amanhã às 10:00", texto: "Reunião de alinhamento com o síndico", href: "/calendario", lida: false, criadoEm: ts(-1, "07:00") },
      { empresaId, usuarioId: null, tipo: "avaliacao", titulo: null, texto: "Sua empresa recebeu uma nova avaliação na rede.", href: "/minha-rede", lida: false, criadoEm: ts(-1, "15:20") },
    ],
  });

  // ---------------------------------------------------------------- rede: perfis, parceiros, avaliações
  const categoria =
    (await prisma.categoria.findUnique({ where: { slug: "construcao-civil" } })) ??
    (await prisma.categoria.create({ data: { nome: "Construção civil", slug: "construcao-civil", ordem: 1, criadoEm: agora, atualizadoEm: agora } }));
  const profissaoId: Record<string, string> = {};
  for (const nome of ["Pedreiro", "Eletricista", "Encanador", "Pintor", "Engenheiro", "Arquiteto", "Gesseiro"]) {
    const slug = gerarSlug(nome);
    const existente = await prisma.profissao.findUnique({ where: { slug } });
    profissaoId[nome] = (existente ?? (await prisma.profissao.create({ data: { nome, slug, categoriaId: categoria.id, criadoEm: agora, atualizadoEm: agora } }))).id;
  }

  interface PerfilDef { chave: string; nome: string; tipo: "pj" | "pf"; desc: string; cidade: string; areas: string[]; profs: string[]; fone: string; insta: string; criado: number }
  const perfis: PerfilDef[] = [
    { chave: "horizonte", nome: "Horizonte Reformas", tipo: "pj", desc: "Reformas residenciais e comerciais, recuperação de fachadas e obras de pequeno e médio porte. Acompanhamento de custo por projeto e cronograma compartilhado com o cliente.", cidade: "Rio de Janeiro", areas: ["Rio de Janeiro", "Niterói", "Duque de Caxias"], profs: ["Engenheiro", "Pedreiro", "Pintor"], fone: "21999990001", insta: "horizonte.reformas.demo", criado: -110 },
    { chave: "luz", nome: "Luz Instalações Elétricas", tipo: "pj", desc: "Instalações e manutenção elétrica residencial e predial, quadros de distribuição e laudos.", cidade: "Rio de Janeiro", areas: ["Rio de Janeiro", "Baixada Fluminense"], profs: ["Eletricista"], fone: "21999990002", insta: "luz.eletrica.demo", criado: -100 },
    { chave: "hidro", nome: "HidroCerto Encanamentos", tipo: "pj", desc: "Hidráulica de obra e manutenção, detecção de vazamentos e instalação de sistemas de reuso.", cidade: "Niterói", areas: ["Niterói", "São Gonçalo", "Rio de Janeiro"], profs: ["Encanador"], fone: "21999990003", insta: "hidrocerto.demo", criado: -95 },
    { chave: "colorir", nome: "Colorir Pinturas e Texturas", tipo: "pj", desc: "Pintura residencial, predial e industrial, texturas e grafiato com equipe própria.", cidade: "Rio de Janeiro", areas: ["Rio de Janeiro", "Niterói"], profs: ["Pintor"], fone: "21999990004", insta: "colorir.pinturas.demo", criado: -90 },
    { chave: "ana", nome: "Ana Beatriz Tavares", tipo: "pf", desc: "Arquiteta com foco em reformas de apartamentos e projetos comerciais, com acompanhamento de obra.", cidade: "Rio de Janeiro", areas: ["Rio de Janeiro"], profs: ["Arquiteto"], fone: "21999990005", insta: "anabeatriz.arq.demo", criado: -85 },
    { chave: "gesso", nome: "Forma Gesso e Acabamentos", tipo: "pj", desc: "Forros, drywall, sancas e molduras em gesso para obras residenciais e comerciais.", cidade: "Duque de Caxias", areas: ["Duque de Caxias", "Rio de Janeiro"], profs: ["Gesseiro"], fone: "21999990006", insta: "formagesso.demo", criado: -80 },
    { chave: "pedreiro", nome: "Sérgio Matos Alvenaria", tipo: "pf", desc: "Pedreiro com 18 anos de experiência em alvenaria, reboco, contrapiso e revestimentos.", cidade: "São Gonçalo", areas: ["São Gonçalo", "Niterói"], profs: ["Pedreiro"], fone: "21999990007", insta: "sergio.alvenaria.demo", criado: -70 },
  ];

  const empresaDoPerfil: Record<string, string> = { horizonte: empresaId };
  const usuarioDoPerfil: Record<string, string> = { horizonte: marina };
  for (const [i, p] of perfis.entries()) {
    if (p.chave !== "horizonte") {
      const emp = randomUUID();
      const usu = randomUUID();
      await prisma.empresa.create({
        data: { id: emp, documento: p.tipo === "pj" ? `3100000000${String(100 + i).padStart(4, "0")}` : `0000000${String(1000 + i)}`, razaoSocial: p.nome, nomeFantasia: p.nome, tipoPessoa: p.tipo, plano: "gratuito", cidade: p.cidade, estado: "RJ", aceiteTermosVersao: "demo", aceiteTermosEm: agora, criadoEm: ts(p.criado), atualizadoEm: agora },
      });
      await prisma.usuario.create({
        data: { id: usu, empresaId: emp, nome: p.nome, email: `${p.chave}@parceiro-demo.test`, senhaHash: "sem-login", papel: "dono", emailConfirmadoEm: ts(p.criado), emailsPromocionais: false, criadoEm: ts(p.criado), atualizadoEm: agora },
      });
      empresaDoPerfil[p.chave] = emp;
      usuarioDoPerfil[p.chave] = usu;
    }
  }

  const perfilId: Record<string, string> = {};
  for (const p of perfis) {
    const id = randomUUID();
    perfilId[p.chave] = id;
    await prisma.perfilPublico.create({
      data: {
        id,
        slug: gerarSlug(p.nome),
        tipo: p.tipo,
        status: "publicado",
        nome: p.nome,
        nomeFantasia: p.tipo === "pj" ? p.nome : null,
        razaoSocial: p.chave === "horizonte" ? "Horizonte Reformas e Construções Ltda" : null,
        descricao: p.desc,
        nomeBusca: normalizarBusca(p.nome),
        cidadeBusca: normalizarBusca(p.cidade),
        estado: "RJ",
        cidade: p.cidade,
        areasAtendimento: p.areas,
        whatsapp: p.fone,
        whatsappPublico: true,
        instagram: p.insta,
        empresaId: empresaDoPerfil[p.chave]!,
        criadoEm: ts(p.criado),
        atualizadoEm: agora,
      },
    });
    for (const nome of p.profs) await prisma.perfilProfissao.create({ data: { perfilId: id, profissaoId: profissaoId[nome]! } });
  }

  const servicos = [
    { nome: "Reforma completa de apartamentos", desc: "Demolição, elétrica, hidráulica, revestimentos e pintura, com cronograma e orçamento por etapa." },
    { nome: "Recuperação de fachadas", desc: "Tratamento de trincas, impermeabilização e pintura de edifícios, com equipe e andaimes próprios." },
    { nome: "Obras comerciais", desc: "Lojas, salas e galpões, com prazo combinado e acompanhamento de custo." },
  ];
  const servicoId: string[] = [];
  for (const [i, s] of servicos.entries()) {
    const id = randomUUID();
    servicoId.push(id);
    await prisma.servico.create({ data: { id, perfilId: perfilId.horizonte!, nome: s.nome, descricao: s.desc, ordem: i, criadoEm: ts(-108) } });
  }
  const trabalhos = [
    { titulo: "Loja Conceito, Shopping Central", desc: "Obra comercial de 140 m², entregue dentro do prazo, com instalações novas e acabamento personalizado.", s: 2, data: dia(-40) },
    { titulo: "Reforma de cobertura duplex, Tijuca", desc: "Reforma completa com troca de instalações e ampliação da varanda.", s: 0, data: dia(-180) },
    { titulo: "Fachada Residencial Ipanema", desc: "Recuperação de fachada de edifício de 8 andares com impermeabilização.", s: 1, data: dia(-260) },
  ];
  for (const [i, t] of trabalhos.entries()) {
    await prisma.trabalho.create({ data: { perfilId: perfilId.horizonte!, titulo: t.titulo, descricao: t.desc, servicoId: servicoId[t.s]!, galeria: "Projetos entregues", dataTrabalho: t.data, ordem: i, criadoEm: ts(-100 + i), atualizadoEm: agora } });
  }

  // Avaliações: parceiros avaliam a Horizonte e a Horizonte avalia parceiros, com notas e comentários variados.
  const aval: { de: string; para: string; nota: number; texto: string; pros: string[]; contras: string[]; dia: number; resposta?: string }[] = [
    { de: "luz", para: "horizonte", nota: 5, texto: "Trabalhamos juntos em três obras. Cronograma claro, pagamento em dia e comunicação direta com o mestre de obras.", pros: ["pontualidade", "comunicacao", "organizacao"], contras: [], dia: -30 },
    { de: "hidro", para: "horizonte", nota: 5, texto: "Equipe organizada e canteiro limpo. Os materiais chegaram a tempo e a obra não parou por falta de nada.", pros: ["organizacao", "cumpriu_orcamento"], contras: [], dia: -26 },
    { de: "ana", para: "horizonte", nota: 4, texto: "Executaram meu projeto de reforma com fidelidade. Houve um pequeno atraso na etapa do revestimento, avisado com antecedência.", pros: ["qualidade", "comunicacao"], contras: ["atraso"], dia: -19, resposta: "Obrigada, Ana! O atraso foi por causa da entrega do porcelanato, e já reforçamos o controle de estoque para evitar isso." },
    { de: "colorir", para: "horizonte", nota: 5, texto: "Contratante exigente no melhor sentido: define bem o escopo e respeita o combinado.", pros: ["pontualidade", "preco_justo"], contras: [], dia: -12 },
    { de: "gesso", para: "horizonte", nota: 4, texto: "Boa parceria na obra do shopping. Pagamento dentro do prazo combinado.", pros: ["pontualidade"], contras: [], dia: -8 },
    { de: "horizonte", para: "luz", nota: 5, texto: "Eletricista cuidadoso, entrega laudo e deixa o quadro identificado. Recomendo.", pros: ["qualidade", "organizacao"], contras: [], dia: -22 },
    { de: "horizonte", para: "hidro", nota: 4, texto: "Resolveu um vazamento de difícil acesso no mesmo dia. Orçamento veio um pouco acima do combinado inicialmente, mas ajustaram.", pros: ["qualidade", "comunicacao"], contras: ["preco_acima"], dia: -17 },
    { de: "horizonte", para: "colorir", nota: 5, texto: "Acabamento impecável e equipe pontual. Fecharam a fachada antes do prazo.", pros: ["qualidade", "pontualidade"], contras: [], dia: -10 },
    { de: "horizonte", para: "gesso", nota: 3, texto: "Bom acabamento, mas o prazo de entrega do forro passou do combinado em uma semana.", pros: ["qualidade"], contras: ["atraso"], dia: -6 },
    { de: "luz", para: "hidro", nota: 5, texto: "Atende bem obras prediais e sempre avisa antes de abrir parede.", pros: ["comunicacao"], contras: [], dia: -14 },
    { de: "ana", para: "pedreiro", nota: 5, texto: "Acabamento muito bom em reboco e contrapiso. Sérgio resolve problemas na hora.", pros: ["qualidade", "pontualidade"], contras: [], dia: -9 },
  ];
  for (const a of aval) {
    const id = randomUUID();
    await prisma.avaliacao.create({
      data: { id, perfilId: perfilId[a.para]!, avaliadorEmpresaId: empresaDoPerfil[a.de]!, avaliadorUsuarioId: usuarioDoPerfil[a.de]!, nota: a.nota, comentario: a.texto, pros: a.pros, contras: a.contras, criadoEm: ts(a.dia, "11:00"), atualizadoEm: ts(a.dia, "11:00") },
    });
    if (a.resposta) {
      await prisma.respostaAvaliacao.create({ data: { avaliacaoId: id, autorEmpresaId: empresaId, autorUsuarioId: marina, texto: a.resposta, criadoEm: ts(a.dia + 1, "09:00"), atualizadoEm: ts(a.dia + 1, "09:00") } });
    }
  }
  const indicacoes: [string, string][] = [["horizonte", "luz"], ["horizonte", "hidro"], ["horizonte", "colorir"], ["luz", "horizonte"], ["hidro", "horizonte"], ["ana", "horizonte"], ["ana", "pedreiro"]];
  for (const [de, para] of indicacoes) {
    await prisma.indicacao.create({ data: { perfilId: perfilId[para]!, indicadoPorEmpresaId: empresaDoPerfil[de]!, criadoEm: ts(-15) } });
  }

  return { credenciais, resumo: `Contas: ${contas.length} · Produtos: ${produtos.length} · Compromissos: ${compromissos.length} · Perfis: ${perfis.length} · Avaliações: ${aval.length}` };
}

cliente
  .$transaction((tx) => main(tx), { timeout: 15 * 60_000, maxWait: 60_000 })
  .then(({ credenciais, resumo }) => {
    writeFileSync(
      ".demo-credenciais.txt",
      ["Credenciais da demonstração (dados fictícios). Este arquivo é ignorado pelo git; não compartilhe.", "", ...credenciais, "", "Site: http://localhost:3100  (yarn demo:dev)", ""].join("\n"),
      "utf8",
    );
    console.log("Demonstração criada na branch separada. Credenciais em .demo-credenciais.txt");
    console.log(resumo);
  })
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => cliente.$disconnect());
