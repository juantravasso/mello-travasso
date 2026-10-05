import { cn } from "@/lib/cn";

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const primeira = partes[0]?.[0] ?? "?";
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : "";
  return `${primeira}${ultima}`.toUpperCase();
}

/** Logo do perfil quando existe; senão as iniciais do nome. */
export function AvatarIniciais({
  nome,
  logoUrl,
  className,
}: {
  nome: string;
  logoUrl?: string;
  className?: string;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={`Logo de ${nome}`}
        className={cn("h-12 w-12 flex-shrink-0 rounded-lg border border-border bg-surface object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/15 text-base font-semibold text-primary",
        className,
      )}
    >
      {iniciais(nome)}
    </span>
  );
}
