import { CORES_MARCA } from "@/lib/marca";

// Símbolo da marca para imagens geradas por código (favicon, ícone do app, compartilhamento).
// É o mesmo desenho de SimboloMarca; fica separado porque ImageResponse só aceita JSX com estilos
// inline, sem classes nem componentes de cliente.
export function SimboloImagem({ lado }: { lado: number }) {
  return (
    <svg width={lado} height={lado} viewBox="0 0 40 40">
      <rect width="40" height="40" rx="9" fill={CORES_MARCA.navy} />
      <g fill="none" strokeWidth="3.2" strokeLinecap="round">
        <rect x="17" y="13.5" width="18" height="13" rx="6.5" stroke={CORES_MARCA.ouro} />
        <rect x="5" y="13.5" width="18" height="13" rx="6.5" stroke={CORES_MARCA.elo} />
        <path d="M23.5 13.5A6.5 6.5 0 0 0 17 20" stroke={CORES_MARCA.ouro} />
      </g>
    </svg>
  );
}
