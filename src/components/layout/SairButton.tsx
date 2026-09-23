"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sair } from "@/services/data/server/authActions";
import { Button } from "@/components/ui/Button";

export function SairButton() {
  const router = useRouter();
  const [emAndamento, iniciarTransicao] = useTransition();
  const [erro, setErro] = useState(false);

  function clicar() {
    iniciarTransicao(async () => {
      const resultado = await sair();
      if (resultado.ok) {
        router.push("/login");
        router.refresh();
      } else {
        setErro(true);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button variante="outline" onClick={clicar} aria-busy={emAndamento} disabled={emAndamento}>
        {emAndamento ? "Saindo…" : "Sair"}
      </Button>
      {erro && <span className="text-xs text-danger">Não foi possível sair agora. Tente de novo.</span>}
    </div>
  );
}
