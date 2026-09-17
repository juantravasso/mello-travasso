"use client";

import { useEffect, useState } from "react";
import { useUsuarioAtual } from "@/hooks/useUsuarioAtual";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export function PreferenciasUsuarioForm() {
  const { usuario, carregado, definirUsuario } = useUsuarioAtual();
  const [nome, setNome] = useState("");
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    if (carregado) setNome(usuario);
  }, [carregado, usuario]);

  function salvar() {
    definirUsuario(nome);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  }

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <p className="font-medium text-foreground">Seu nome</p>
        <p className="text-sm text-muted">
          Este navegador não tem login — o nome abaixo é usado para registrar quem criou, baixou ou
          cancelou cada lançamento no histórico.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Input className="flex-1" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Márcio" />
        <Button onClick={salvar} disabled={nome.trim() === ""}>
          {salvo ? "Salvo!" : "Salvar"}
        </Button>
      </div>
    </Card>
  );
}
