import { MARCA } from "@/lib/marca";
import {
  IconeAjuda,
  IconeBusca,
  IconeCaixa,
  IconeCalendario,
  IconeCamera,
  IconeConfig,
  IconeDashboard,
  IconeEntrada,
  IconeEscudo,
  IconeEtiqueta,
  IconeFornecedor,
  IconeObra,
  IconePessoas,
  IconeRede,
  IconeSaida,
} from "./icones";

// Lista única das abas do app. A barra lateral do computador, o menu lateral do celular e a barra de baixo (só os
// favoritos) leem daqui, então uma aba nova entra nos três de uma vez. Quem pode ver cada aba continua sendo decidido
// por podeAcessarRota (módulos liberados pelo dono) e pelo plano.

export type GrupoNavegacao = "profissionais" | "gestao" | "conta" | "admin";

export interface ItemNavegacao {
  href: string;
  rotulo: string;
  /** Nome curto para a barra de baixo, onde falta espaço. */
  rotuloCurto: string;
  Icone: typeof IconeDashboard;
  grupo: GrupoNavegacao;
  /** Módulo de gestão: sem o plano de gestão fica apagado e leva à apresentação. */
  gestao?: boolean;
  /** Outras rotas que contam como "estou nesta aba". */
  tambem?: readonly string[];
  /** Aparece com mais força (Encontrar profissionais). */
  destaque?: boolean;
}

export const TITULO_GRUPO: Record<GrupoNavegacao, string> = {
  profissionais: MARCA.produtos.profissionais.nome,
  gestao: MARCA.produtos.gestao.nome,
  conta: "Minha conta",
  admin: "Plataforma",
};

export const ITENS_NAVEGACAO: readonly ItemNavegacao[] = [
  { href: "/rede", rotulo: "Encontrar profissionais", rotuloCurto: "Buscar", Icone: IconeBusca, grupo: "profissionais", destaque: true },
  { href: "/minha-rede", rotulo: "Minha rede", rotuloCurto: "Minha rede", Icone: IconeRede, grupo: "profissionais" },
  { href: "/dashboard", rotulo: "Dashboard", rotuloCurto: "Início", Icone: IconeDashboard, grupo: "gestao", gestao: true },
  { href: "/calendario", rotulo: "Calendário", rotuloCurto: "Agenda", Icone: IconeCalendario, grupo: "gestao", gestao: true },
  { href: "/capturar", rotulo: "Captura de documentos", rotuloCurto: "Capturar", Icone: IconeCamera, grupo: "gestao", gestao: true },
  { href: "/contas-a-pagar", rotulo: "Contas a pagar", rotuloCurto: "A Pagar", Icone: IconeSaida, grupo: "gestao", gestao: true },
  { href: "/contas-a-receber", rotulo: "Contas a receber", rotuloCurto: "A Receber", Icone: IconeEntrada, grupo: "gestao", gestao: true },
  { href: "/obras", rotulo: "Projetos", rotuloCurto: "Projetos", Icone: IconeObra, grupo: "gestao", gestao: true },
  { href: "/estoque", rotulo: "Estoque", rotuloCurto: "Estoque", Icone: IconeCaixa, grupo: "gestao", gestao: true, tambem: ["/custos-produtos"] },
  { href: "/funcionarios", rotulo: "Funcionários", rotuloCurto: "Equipe", Icone: IconePessoas, grupo: "gestao", gestao: true },
  { href: "/fornecedores", rotulo: "Fornecedores", rotuloCurto: "Fornec.", Icone: IconeFornecedor, grupo: "gestao", gestao: true },
  { href: "/planos", rotulo: "Planos e valores", rotuloCurto: "Planos", Icone: IconeEtiqueta, grupo: "conta" },
  { href: "/ajuda", rotulo: "Ajuda e tutoriais", rotuloCurto: "Ajuda", Icone: IconeAjuda, grupo: "conta" },
  { href: "/configuracoes", rotulo: "Configurações", rotuloCurto: "Ajustes", Icone: IconeConfig, grupo: "conta" },
  { href: "/admin", rotulo: "Administração", rotuloCurto: "Admin", Icone: IconeEscudo, grupo: "admin" },
];

/** A rota atual pertence a este item? (a própria rota, as de dentro dela e as listadas em `tambem`) */
export function itemAtivo(item: Pick<ItemNavegacao, "href" | "tambem">, pathname: string): boolean {
  const prefixos = [item.href, ...(item.tambem ?? [])];
  return prefixos.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
