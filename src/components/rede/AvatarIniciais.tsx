import { cn } from "@/lib/cn";

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const primeira = partes[0]?.[0] ?? "?";
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : "";
  return `${primeira}${ultima}`.toUpperCase();
}

export function AvatarIniciais({ nome, className }: { nome: string; className?: string }) {
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
