"use client";

import { useState } from "react";
import Link from "next/link";
import { useFuncionario } from "@/hooks/useFuncionario";
import { useObras } from "@/hooks/useObras";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusFuncionarioBadge } from "@/components/ui/StatusFuncionarioBadge";
import { formatarData, formatarMoeda } from "@/lib/formatadores";

export function FuncionarioDetalhe({ funcionarioId }: { funcionarioId: string }) {
  const { funcionario, carregando, definirStatus } = useFuncionario(funcionarioId);
  const { obras } = useObras();
  const [alternandoStatus, setAlternandoStatus] = useState(false);

  if (carregando) return <p className="text-sm text-muted">Carregando…</p>;
  if (!funcionario) return <p className="text-sm text-danger">Funcionário não encontrado.</p>;

  const obra = obras.find((o) => o.id === funcionario.obraId);

  async function alternarStatus() {
    if (!funcionario) return;
    setAlternandoStatus(true);
    try {
      await definirStatus(funcionario.status === "ativo" ? "inativo" : "ativo");
    } finally {
      setAlternandoStatus(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-center gap-4">
        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-xl font-semibold text-primary">
          {funcionario.nome
            .split(" ")
            .slice(0, 2)
            .map((p) => p[0])
            .join("")
            .toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold">{funcionario.nome}</h2>
          <p className="truncate text-sm text-muted">{funcionario.cargo}</p>
        </div>
        <StatusFuncionarioBadge status={funcionario.status} />
      </Card>

      <Card className="flex flex-col gap-2 text-sm">
        <Linha rotulo="Telefone" valor={funcionario.telefone ?? "—"} />
        <Linha rotulo="E-mail" valor={funcionario.email ?? "—"} />
        <Linha rotulo="CPF" valor={funcionario.cpf ?? "—"} />
        <Linha rotulo="Data de admissão" valor={formatarData(funcionario.dataAdmissao)} />
        <Linha rotulo="Salário" valor={funcionario.salario ? formatarMoeda(funcionario.salario) : "—"} />
        <Linha
          rotulo="Projeto alocado"
          valor={obra ? <Link href={`/obras/${obra.id}`} className="text-primary underline">{obra.nome}</Link> : "—"}
        />
      </Card>

      <Button variante={funcionario.status === "ativo" ? "outline" : "primary"} onClick={alternarStatus} disabled={alternandoStatus}>
        {alternandoStatus ? "Salvando…" : funcionario.status === "ativo" ? "Marcar como inativo" : "Reativar funcionário"}
      </Button>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted">{rotulo}</span>
      <span className="text-right font-medium">{valor}</span>
    </div>
  );
}
