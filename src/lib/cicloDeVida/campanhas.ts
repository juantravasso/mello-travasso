import { escaparHtml } from "@/lib/email/escapar";
import { CORES_MARCA, MARCA } from "@/lib/marca";

// Campanhas de e-mail do ciclo de vida: quando cada uma se aplica e o texto que sai. Puro (sem banco, sem relógio):
// o servidor lê os sinais da empresa e decide; aqui só ficam as regras e os modelos, que dá para testar.
//
// Duas categorias, tratadas à parte:
//  - transacional: sobre a conta (boas-vindas, fim do teste, extensão). Não depende da preferência de comunicação.
//  - promocional: dicas e sugestões de uso. Respeita o descadastro e leva o link para parar de receber.

export type CampanhaId = "boas_vindas" | "primeira_acao" | "problema" | "recursos" | "fim_do_teste" | "teste_estendido";
export type Categoria = "transacional" | "promocional";

export const CATEGORIA_DA_CAMPANHA: Record<CampanhaId, Categoria> = {
  boas_vindas: "transacional",
  primeira_acao: "promocional",
  problema: "promocional",
  recursos: "promocional",
  fim_do_teste: "transacional",
  teste_estendido: "transacional",
};

/** O que a empresa já fez. A campanha só sai se a ação que ela ensina ainda não foi feita. */
export interface SinaisDaEmpresa {
  plano: string;
  contas: number;
  /** Projetos de verdade (o Depósito não conta). */
  obras: number;
  produtos: number;
  compromissos: number;
  perfilPublicado: boolean;
}

const emTeste = (s: SinaisDaEmpresa) => s.plano === "teste";
const soRede = (s: SinaisDaEmpresa) => s.plano === "gratuito";

/** Recursos de gestão que a empresa em teste ainda não usou, na ordem em que valem ser apresentados. */
export function recursosNaoUsados(s: SinaisDaEmpresa): ("captura" | "estoque" | "calendario")[] {
  const lista: ("captura" | "estoque" | "calendario")[] = [];
  if (s.contas === 0) lista.push("captura");
  if (s.produtos === 0) lista.push("estoque");
  if (s.compromissos === 0) lista.push("calendario");
  return lista;
}

/** A campanha ainda faz sentido para esta empresa agora? Conferido ao agendar e de novo na hora de enviar. */
export function campanhaSeAplica(campanha: CampanhaId, s: SinaisDaEmpresa): boolean {
  switch (campanha) {
    case "boas_vindas":
      return emTeste(s) || soRede(s);
    case "primeira_acao":
      return emTeste(s) ? s.contas === 0 : soRede(s) ? !s.perfilPublicado : false;
    case "problema":
      return emTeste(s) ? s.produtos === 0 || s.compromissos === 0 : soRede(s);
    case "recursos":
      return emTeste(s) ? recursosNaoUsados(s).length > 0 : soRede(s);
    case "fim_do_teste":
    case "teste_estendido":
      return emTeste(s);
  }
}

export interface ContextoEmail {
  nome: string;
  /** Endereço do site sem barra final. */
  urlSite: string;
  sinais: SinaisDaEmpresa;
  diasDeTeste: number;
  /** Fim do teste, já formatado ("dd/mm/aaaa"). */
  fimFormatado?: string;
  /** Dias que faltam; 0 = termina hoje. */
  diasRestantes?: number;
  /** Dias concedidos na extensão. */
  diasExtensao?: number;
  /** Link para parar de receber as comunicações promocionais (só nas promocionais). */
  linkDescadastro?: string;
}

export interface EmailMontado {
  assunto: string;
  texto: string;
  html: string;
}

interface Conteudo {
  assunto: string;
  /** Parágrafos em texto puro; o HTML é gerado escapando cada um. */
  paragrafos: string[];
  /** Passos numerados opcionais. */
  passos?: string[];
  cta: { rotulo: string; caminho: string };
  /** Linha de fechamento sobre o que acontece depois (ex.: o que continua no fim do teste). */
  fechamento?: string;
}

const GESTAO = MARCA.produtos.gestao.nome;
const REDE = MARCA.produtos.profissionais.nome;

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] || "olá";
}

function conteudoDe(campanha: CampanhaId, c: ContextoEmail): Conteudo {
  const s = c.sinais;
  switch (campanha) {
    case "boas_vindas":
      return soRede(s)
        ? {
            assunto: `Bem-vindo ao ${MARCA.nome}`,
            paragrafos: [
              `Sua conta no ${REDE} está criada. É por ela que empresas e profissionais encontram você e que você encontra quem contratar.`,
              "O passo que mais faz diferença agora é completar o seu perfil: com ele publicado, você aparece na busca.",
            ],
            cta: { rotulo: "Completar meu perfil", caminho: "/minha-rede/perfil" },
            fechamento: `Quando quiser, você também pode experimentar o ${GESTAO} (projetos, contas, estoque e calendário).`,
          }
        : {
            assunto: `Bem-vindo ao ${MARCA.nome}: seus ${c.diasDeTeste} dias de teste começaram`,
            paragrafos: [
              `Sua conta está criada e você tem ${c.diasDeTeste} dias para testar o ${GESTAO} e o ${REDE}, sem cartão de crédito.`,
              "O ponto de partida é o painel: dali você chega a projetos, contas a pagar e a receber, estoque e calendário.",
            ],
            cta: { rotulo: "Abrir meu painel", caminho: "/dashboard" },
            fechamento: c.fimFormatado ? `Seu teste vai até ${c.fimFormatado}. Os seus dados continuam disponíveis para consulta depois disso.` : undefined,
          };

    case "primeira_acao":
      return soRede(s)
        ? {
            assunto: "Seu perfil ainda não aparece na busca",
            paragrafos: [
              `Quem procura um profissional no ${REDE} só encontra perfis publicados, e o seu ainda não está.`,
              "Leva poucos minutos: escolha a profissão, descreva o que você faz e publique.",
            ],
            cta: { rotulo: "Publicar meu perfil", caminho: "/minha-rede/perfil" },
          }
        : {
            assunto: "Lance sua primeira conta em poucos minutos",
            paragrafos: [
              "Notas e recibos acumulados em papel ou no celular são o começo da bagunça de uma obra. Lançar a primeira conta já mostra como o sistema organiza isso.",
            ],
            passos: [
              "Abra Capturar e fotografe a nota ou o comprovante (ou lance a conta à mão).",
              "Confira os dados lidos e escolha o projeto, ou o Depósito, para onde a compra foi.",
              "Salve: a conta entra em contas a pagar com o vencimento.",
            ],
            cta: { rotulo: "Lançar minha primeira conta", caminho: "/capturar" },
          };

    case "problema":
      if (soRede(s)) {
        return {
          assunto: "Precisa de um profissional de confiança?",
          paragrafos: [
            `No ${REDE} você busca por profissão e cidade, vê o perfil, os trabalhos e as avaliações de quem já contratou.`,
            "Se tem uma obra ou serviço em vista, comece pela busca.",
          ],
          cta: { rotulo: "Buscar profissionais", caminho: "/rede" },
        };
      }
      return s.produtos === 0
        ? {
            assunto: "Quanto material sobrou em cada obra?",
            paragrafos: [
              "Material comprado e esquecido, ou comprado duas vezes, é custo que passa despercebido. O estoque mostra o saldo de cada projeto e do Depósito.",
              "Compras lançadas na captura entram no estoque do destino escolhido, e você pode transferir do Depósito para um projeto, com o valor da última compra.",
            ],
            cta: { rotulo: "Ver o estoque", caminho: "/estoque" },
          }
        : {
            assunto: "Não perca o prazo da próxima conta ou visita",
            paragrafos: [
              "O calendário reúne compromissos e avisa por e-mail e dentro do sistema, para você ou para a equipe, na véspera e no dia.",
            ],
            passos: ["Abra o Calendário e crie um compromisso.", "Escolha a data e, se quiser, compartilhe com alguém da equipe."],
            cta: { rotulo: "Abrir o calendário", caminho: "/calendario" },
          };

    case "recursos":
      if (soRede(s)) {
        return {
          assunto: `Conheça o ${GESTAO}`,
          paragrafos: [
            `Além do ${REDE}, a plataforma tem o ${GESTAO}: projetos, contas a pagar e a receber, estoque, captura de notas e calendário num lugar só.`,
            `Você pode experimentar por ${c.diasDeTeste} dias, sem cartão de crédito.`,
          ],
          cta: { rotulo: `Conhecer o ${GESTAO}`, caminho: "/dashboard" },
        };
      }
      return {
        assunto: "Recursos do seu teste que você ainda não usou",
        paragrafos: [
          `Você ainda não experimentou: ${recursosNaoUsados(s).map(ROTULO_RECURSO).join(", ")}.`,
          "Vale abrir pelo menos um: é o jeito mais rápido de saber se ele resolve algo da sua rotina.",
          ...(c.fimFormatado ? [`O teste vai até ${c.fimFormatado}.`] : []),
        ],
        cta: { rotulo: "Abrir meu painel", caminho: "/dashboard" },
      };

    case "fim_do_teste": {
      const quando =
        c.diasRestantes === undefined || c.diasRestantes <= 0
          ? "termina hoje"
          : c.diasRestantes === 1
            ? "termina amanhã"
            : `termina em ${c.diasRestantes} dias`;
      return {
        assunto: c.diasRestantes !== undefined && c.diasRestantes <= 0 ? "Seu teste termina hoje" : `Seu teste ${quando}`,
        paragrafos: [
          `O seu teste do ${MARCA.nome} ${quando}${c.fimFormatado ? ` (${c.fimFormatado})` : ""}.`,
          "Quando ele terminar, a conta passa a ser somente para consulta: nada é apagado, e você continua vendo tudo o que lançou. Para seguir lançando e editando, é preciso um plano.",
          `Para saber como continuar, ou pedir mais tempo para avaliar, escreva para ${MARCA.emailContato}.`,
        ],
        cta: { rotulo: "Ver meu plano", caminho: "/configuracoes" },
      };
    }

    case "teste_estendido":
      return {
        assunto: "Seu teste foi estendido",
        paragrafos: [
          `A equipe do ${MARCA.nome} estendeu o seu teste${c.diasExtensao ? ` em ${c.diasExtensao} dia(s)` : ""}.`,
          c.fimFormatado ? `O novo término é ${c.fimFormatado}.` : "O novo prazo já aparece nas suas configurações.",
        ],
        cta: { rotulo: "Voltar ao sistema", caminho: "/dashboard" },
      };
  }
}

const ROTULO_RECURSO = (r: "captura" | "estoque" | "calendario"): string =>
  r === "captura" ? "lançar contas pela captura de notas" : r === "estoque" ? "o controle de estoque" : "o calendário com lembretes";

function montarHtml(titulo: string, conteudo: Conteudo, c: ContextoEmail, link: string): string {
  const paragrafos = conteudo.paragrafos.map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#3a4252;">${escaparHtml(p)}</p>`).join("");
  const passos = conteudo.passos
    ? `<ol style="margin:0 0 14px;padding-left:20px;font-size:15px;line-height:1.55;color:#3a4252;">${conteudo.passos.map((p) => `<li style="margin-bottom:4px;">${escaparHtml(p)}</li>`).join("")}</ol>`
    : "";
  const fechamento = conteudo.fechamento ? `<p style="margin:14px 0 0;font-size:14px;line-height:1.5;color:#667085;">${escaparHtml(conteudo.fechamento)}</p>` : "";
  const rodape = c.linkDescadastro
    ? `Você recebe estas dicas porque criou uma conta no ${escaparHtml(MARCA.nome)}. <a href="${escaparHtml(c.linkDescadastro)}" style="color:#667085;">Parar de receber dicas por e-mail</a>.`
    : `Este é um aviso sobre a sua conta no ${escaparHtml(MARCA.nome)}.`;
  return (
    '<body style="margin:0;padding:0;background:#f3f5f8;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f8;padding:24px 12px;"><tr><td align="center">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:10px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#171b24;">' +
    `<tr><td style="background:${CORES_MARCA.navy};padding:18px 24px;color:#ffffff;font-size:18px;font-weight:bold;">Elo <span style="font-weight:normal;">Negócios</span></td></tr>` +
    `<tr><td style="padding:24px 24px 8px;"><h1 style="margin:0 0 14px;font-size:20px;line-height:1.3;color:#171b24;">${escaparHtml(titulo)}</h1>` +
    `<p style="margin:0 0 12px;font-size:15px;color:#3a4252;">Olá, ${escaparHtml(primeiroNome(c.nome))}.</p>${paragrafos}${passos}</td></tr>` +
    `<tr><td style="padding:8px 24px 24px;"><a href="${escaparHtml(link)}" style="display:inline-block;padding:12px 20px;background:${CORES_MARCA.navy};color:#ffffff;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">${escaparHtml(conteudo.cta.rotulo)}</a>${fechamento}</td></tr>` +
    `<tr><td style="padding:14px 24px;border-top:1px solid #e1e4ea;font-size:12px;line-height:1.5;color:#667085;">${rodape}</td></tr>` +
    "</table></td></tr></table></body>"
  );
}

/** Monta assunto, texto e HTML da campanha. O link principal sempre leva direto à tela da ação ensinada. */
export function montarEmail(campanha: CampanhaId, c: ContextoEmail): EmailMontado {
  const conteudo = conteudoDe(campanha, c);
  const link = `${c.urlSite.replace(/\/+$/, "")}${conteudo.cta.caminho}`;
  const partes = [`Olá, ${primeiroNome(c.nome)}.`, "", ...conteudo.paragrafos.flatMap((p) => [p, ""])];
  if (conteudo.passos) partes.push(...conteudo.passos.map((p, i) => `${i + 1}. ${p}`), "");
  partes.push(`${conteudo.cta.rotulo}: ${link}`);
  if (conteudo.fechamento) partes.push("", conteudo.fechamento);
  partes.push("", "--", c.linkDescadastro ? `Para parar de receber dicas por e-mail: ${c.linkDescadastro}` : `Este é um aviso sobre a sua conta no ${MARCA.nome}.`);
  return { assunto: conteudo.assunto, texto: partes.join("\n"), html: montarHtml(conteudo.assunto, conteudo, c, link) };
}
