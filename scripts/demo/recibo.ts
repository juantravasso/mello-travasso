// Comprovantes fictícios da demonstração: uma nota ou recibo desenhado em SVG e devolvido como data URL, que é o
// formato em que o sistema guarda comprovantes (ContaFinanceira.comprovanteUrl). Tudo aqui é inventado.

export interface LinhaRecibo {
  descricao: string;
  valor: number;
}

export interface DadosRecibo {
  titulo: "NOTA FISCAL" | "RECIBO";
  emissor: string;
  numero: string;
  data: string;
  linhas: LinhaRecibo[];
  total: number;
}

const xml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function comprovanteSvg(d: DadosRecibo): string {
  const linhas = d.linhas.slice(0, 8);
  const altura = 230 + linhas.length * 26;
  const corpo = linhas
    .map(
      (l, i) =>
        `<text x="28" y="${176 + i * 26}" font-size="14" fill="#2b2f36">${xml(l.descricao.slice(0, 34))}</text>` +
        `<text x="372" y="${176 + i * 26}" font-size="14" fill="#2b2f36" text-anchor="end">${xml(reais(l.valor))}</text>`,
    )
    .join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="${altura}" viewBox="0 0 400 ${altura}" font-family="Arial, Helvetica, sans-serif">` +
    `<rect width="400" height="${altura}" fill="#fbfaf6"/>` +
    `<rect x="10" y="10" width="380" height="${altura - 20}" fill="none" stroke="#c9c6bb" stroke-dasharray="5 4"/>` +
    `<text x="200" y="46" font-size="20" font-weight="700" fill="#1f2430" text-anchor="middle">${xml(d.titulo)}</text>` +
    `<text x="200" y="70" font-size="13" fill="#4a505c" text-anchor="middle">${xml(d.emissor.slice(0, 40))}</text>` +
    `<text x="200" y="90" font-size="11" fill="#7a808c" text-anchor="middle">Documento de demonstração, dados fictícios</text>` +
    `<text x="28" y="122" font-size="13" fill="#4a505c">Nº ${xml(d.numero)}</text>` +
    `<text x="372" y="122" font-size="13" fill="#4a505c" text-anchor="end">${xml(d.data)}</text>` +
    `<line x1="28" y1="136" x2="372" y2="136" stroke="#c9c6bb"/>` +
    `<text x="28" y="156" font-size="11" fill="#7a808c">DESCRIÇÃO</text>` +
    `<text x="372" y="156" font-size="11" fill="#7a808c" text-anchor="end">VALOR</text>` +
    corpo +
    `<line x1="28" y1="${altura - 56}" x2="372" y2="${altura - 56}" stroke="#c9c6bb"/>` +
    `<text x="28" y="${altura - 28}" font-size="16" font-weight="700" fill="#1f2430">TOTAL</text>` +
    `<text x="372" y="${altura - 28}" font-size="16" font-weight="700" fill="#1f2430" text-anchor="end">${xml(reais(d.total))}</text>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}
