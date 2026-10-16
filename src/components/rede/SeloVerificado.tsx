import { Badge } from "@/components/ui/Badge";

/**
 * Selo de quem teve os documentos conferidos pela administração. O texto diz o que
 * foi conferido (empresa ou profissional), nunca "perfil aprovado" ou nota de qualidade.
 */
export function SeloVerificado({ tipo }: { tipo: "pj" | "pf" }) {
  return <Badge tom="success">{tipo === "pj" ? "✓ Empresa verificada" : "✓ Profissional verificado"}</Badge>;
}
