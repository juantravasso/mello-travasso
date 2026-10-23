// Guia para colocar o ícone do Elo Negócios na tela de início do celular. Conteúdo e detecção de plataforma ficam
// aqui, sem React, para serem testados. O texto descreve só o que o ícone faz de fato: abre o site em tela cheia, como
// um aplicativo. Não promete uso offline nem notificações, que não existem.
//
// Os nomes dos botões mudam com a versão do sistema e do navegador, então aparecem como exemplos. Ao mudar o iOS ou o
// Chrome, confira os passos.

export type Plataforma = "ios" | "android";
export type PlataformaDetectada = Plataforma | "outro";

export interface GuiaInstalacao {
  plataforma: Plataforma;
  rotulo: string;
  navegador: string;
  passos: string[];
  observacao: string;
}

export const BENEFICIO_INSTALACAO =
  "O ícone abre o Elo Negócios em tela cheia, como um aplicativo, sem precisar digitar o endereço. Você continua com o mesmo login e os mesmos dados.";

export const GUIAS: Record<Plataforma, GuiaInstalacao> = {
  ios: {
    plataforma: "ios",
    rotulo: "iPhone",
    navegador: "Safari",
    passos: [
      "Abra o Elo Negócios no Safari.",
      "Toque no botão Compartilhar (o quadrado com uma seta para cima). Se não o encontrar, toque antes nos três pontinhos “⋯” da barra do Safari.",
      "Role a lista e toque em “Adicionar à Tela de Início” (pode estar em “Ver Mais”).",
      "Se aparecer a opção “Abrir como app”, deixe ligada.",
      "Confira o nome e toque em “Adicionar”.",
    ],
    observacao:
      "Se você abriu o link dentro de outro aplicativo (como WhatsApp ou Instagram), os passos podem ser diferentes: copie o endereço e abra no Safari.",
  },
  android: {
    plataforma: "android",
    rotulo: "Android",
    navegador: "Chrome",
    passos: [
      "Abra o Elo Negócios no Chrome.",
      "Toque nos três pontinhos “⋮” no canto superior.",
      "Toque em “Instalar app” ou “Adicionar à tela inicial” (o nome muda conforme a versão do Chrome).",
      "Confirme em “Instalar” ou “Adicionar”.",
    ],
    observacao: "Em outros navegadores, como o Samsung Internet, a opção também fica no menu, com nome parecido.",
  },
};

export interface EntradaDeteccao {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
}

/** iPhone e iPad (o iPadOS se apresenta como Mac, mas tem tela de toque), Android, ou "outro" (computador etc.). */
export function detectarPlataforma({ userAgent, platform, maxTouchPoints }: EntradaDeteccao): PlataformaDetectada {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  if (platform === "MacIntel" && (maxTouchPoints ?? 0) > 1) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "outro";
}

/**
 * No iPhone, a pessoa abriu o link fora do Safari (navegador alternativo ou dentro de outro aplicativo). Os passos do
 * Safari podem não valer ali, então o guia avisa para abrir no Safari.
 */
export function ehIosForaDoSafari(userAgent: string): boolean {
  if (!/iPhone|iPad|iPod/i.test(userAgent)) return false;
  return !/Safari/i.test(userAgent) || /CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram|Line\//i.test(userAgent);
}
