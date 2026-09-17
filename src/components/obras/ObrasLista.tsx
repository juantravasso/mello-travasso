"use client";

import { useObras } from "@/hooks/useObras";
import { ObraCard } from "./ObraCard";

export function ObrasLista() {
  const { obras, carregando } = useObras();

  return (
    <div>
      {carregando && <p className="text-sm text-muted">Carregando…</p>}
      {!carregando && obras.length === 0 && <p className="text-sm text-muted">Nenhuma obra cadastrada.</p>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {obras.map((obra) => (
          <ObraCard key={obra.id} obra={obra} />
        ))}
      </div>
    </div>
  );
}
