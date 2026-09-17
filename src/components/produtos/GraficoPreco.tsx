import type { ItemProduto } from "@/types";

const LARGURA = 320;
const ALTURA = 100;
const MARGEM = 8;

export function GraficoPreco({ ocorrencias }: { ocorrencias: ItemProduto[] }) {
  if (ocorrencias.length < 2) {
    return <p className="text-sm text-muted">É preciso pelo menos 2 compras para ver a evolução do preço.</p>;
  }

  const valores = ocorrencias.map((o) => o.valorUnitario);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const intervalo = max - min || 1;

  const pontos = ocorrencias.map((item, indice) => {
    const x = MARGEM + (indice / (ocorrencias.length - 1)) * (LARGURA - 2 * MARGEM);
    const y = ALTURA - MARGEM - ((item.valorUnitario - min) / intervalo) * (ALTURA - 2 * MARGEM);
    return { x, y };
  });

  const caminho = pontos.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} className="w-full text-primary" role="img" aria-label="Evolução do preço unitário">
      <path d={caminho} fill="none" stroke="currentColor" strokeWidth={2} />
      {pontos.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="currentColor" />
      ))}
    </svg>
  );
}
