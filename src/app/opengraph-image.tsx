import { ImageResponse } from "next/og";
import { CORES_MARCA, MARCA, SLOGAN_INICIO } from "@/lib/marca";
import { SimboloImagem } from "@/lib/marcaImagem";

export const alt = `${MARCA.nome}: ${MARCA.slogan}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function ImagemDeCompartilhamento() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: CORES_MARCA.noite,
          color: "#eef1f6",
          padding: 80,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <SimboloImagem lado={96} />
          <div style={{ display: "flex", fontSize: 56, letterSpacing: -1 }}>
            <span style={{ fontWeight: 800 }}>Elo</span>
            <span style={{ fontWeight: 500, marginLeft: 14 }}>Negócios</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 76, fontWeight: 700, lineHeight: 1.1, letterSpacing: -2 }}>
            <div style={{ display: "flex" }}>{SLOGAN_INICIO}</div>
            <div style={{ display: "flex", color: CORES_MARCA.elo }}>{MARCA.sloganDestaque}</div>
          </div>
          <div style={{ display: "flex", gap: 36, fontSize: 30, color: CORES_MARCA.elo }}>
            <span>{MARCA.produtos.gestao.nome}</span>
            <span>{MARCA.produtos.profissionais.nome}</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
