import { escaparHtml } from "@/lib/email/escapar";
import { CORES_MARCA, MARCA } from "@/lib/marca";
import type { TipoLembrete } from "./lembretes";

export interface DadosLembrete {
  tipo: TipoLembrete;
  titulo: string;
  descricao?: string | null;
  /** AAAA-MM-DD no fuso do compromisso. */
  data: string;
  diaInteiro: boolean;
  horaInicio?: string | null;
  horaFim?: string | null;
  criadoPorNome: string;
  /** O destinatário não é o criador: o compromisso foi compartilhado com ele. */
  compartilhado: boolean;
}

export interface DadosEmailLembrete extends DadosLembrete {
  link: string;
}

export interface MensagemLembrete {
  assunto: string;
  texto: string;
  html: string;
}

/** "terça-feira, 20 de outubro de 2026": formatado em UTC sobre a data pura, então não depende do servidor. */
export function dataPorExtenso(data: string): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano ?? 1970, (mes ?? 1) - 1, dia ?? 1)).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function quandoTexto(d: Pick<DadosLembrete, "data" | "diaInteiro" | "horaInicio" | "horaFim">): string {
  const dia = dataPorExtenso(d.data);
  if (d.diaInteiro) return `${dia}, dia inteiro`;
  const fim = d.horaFim ? ` até ${d.horaFim}` : "";
  return `${dia}, às ${d.horaInicio ?? ""}${fim}`;
}

const ROTULO_TIPO: Record<TipoLembrete, { assunto: string; chamada: string }> = {
  vespera: { assunto: "amanhã", chamada: "Lembrete: é amanhã" },
  dia: { assunto: "hoje", chamada: "Lembrete: é hoje" },
};

/** E-mail do lembrete: texto simples e HTML em tabelas com estilos inline (compatível com clientes de e-mail). */
export function montarEmailLembrete(d: DadosEmailLembrete): MensagemLembrete {
  const rotulo = ROTULO_TIPO[d.tipo];
  const quando = quandoTexto(d);
  const origem = d.compartilhado ? `${d.criadoPorNome} compartilhou este compromisso com você.` : `Criado por ${d.criadoPorNome}.`;
  const assunto = `Lembrete (${rotulo.assunto}): ${d.titulo}`;

  const texto =
    `${rotulo.chamada}\n\n` +
    `${d.titulo}\n${quando}\n` +
    (d.descricao ? `\n${d.descricao}\n` : "") +
    `\n${origem}\n\nAbrir no ${MARCA.nome}: ${d.link}\n\n` +
    "Você recebe este aviso porque participa do compromisso. Para parar de receber lembretes por e-mail, ajuste suas preferências em Configurações.";

  const e = escaparHtml;
  const html =
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:0;background:#f3f5f8;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f8;padding:24px 12px;"><tr><td align="center">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:10px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#171b24;">' +
    `<tr><td style="background:${CORES_MARCA.navy};padding:18px 24px;color:#ffffff;font-size:18px;font-weight:bold;">Elo <span style="font-weight:normal;">Negócios</span></td></tr>` +
    `<tr><td style="padding:24px 24px 8px;"><p style="margin:0 0 6px;font-size:13px;color:#0f766e;font-weight:bold;text-transform:uppercase;letter-spacing:.04em;">${e(rotulo.chamada)}</p>` +
    `<h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;">${e(d.titulo)}</h1>` +
    `<p style="margin:0 0 4px;font-size:16px;">${e(quando)}</p></td></tr>` +
    (d.descricao
      ? `<tr><td style="padding:8px 24px;"><p style="margin:0;font-size:15px;line-height:1.5;color:#3a4252;white-space:pre-line;">${e(d.descricao)}</p></td></tr>`
      : "") +
    `<tr><td style="padding:8px 24px 4px;"><p style="margin:0;font-size:14px;color:#667085;">${e(origem)}</p></td></tr>` +
    `<tr><td style="padding:16px 24px 24px;"><a href="${e(d.link)}" style="display:inline-block;padding:12px 20px;background:${CORES_MARCA.navy};color:#ffffff;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">Abrir compromisso</a></td></tr>` +
    `<tr><td style="padding:14px 24px;border-top:1px solid #e1e4ea;font-size:12px;color:#667085;">Você recebe este aviso porque participa do compromisso. Para parar de receber lembretes por e-mail, ajuste suas preferências em Configurações no ${e(MARCA.nome)}.</td></tr>` +
    "</table></td></tr></table></body></html>";

  return { assunto, texto, html };
}

/** Título e texto da notificação dentro do app. */
export function textoNotificacao(d: DadosLembrete): { titulo: string; texto: string } {
  const prefixo = d.tipo === "vespera" ? "Amanhã" : "Hoje";
  const quando = d.diaInteiro ? "dia inteiro" : `às ${d.horaInicio ?? ""}`;
  const origem = d.compartilhado ? ` Compartilhado por ${d.criadoPorNome}.` : "";
  return { titulo: `${prefixo}: ${d.titulo}`, texto: `${prefixo}, ${quando}.${origem}` };
}
