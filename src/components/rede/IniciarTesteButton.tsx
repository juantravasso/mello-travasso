"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { iniciarTesteGratis } from "@/services/data/server/planoActions";
import { Button } from "@/components/ui/Button";

export function IniciarTesteButton({ dias }: { dias: number }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function aoClicar() {
    setErro(null);
    iniciar(async () => {
      const resultado = await iniciarTesteGratis();
      if (resultado.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setErro(resultado.mensagem);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button onClick={aoClicar} disabled={pendente} aria-busy={pendente}>
        {pendente ? "Iniciando…" : `Testar ${dias} dias grátis`}
      </Button>
      {erro && (
        <p role="alert" className="text-xs text-danger">
          {erro}
        </p>
      )}
    </div>
  );
}
