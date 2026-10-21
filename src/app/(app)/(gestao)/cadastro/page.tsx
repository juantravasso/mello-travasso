"use client";

import { useState } from "react";
import Link from "next/link";
import { ObrasLista } from "@/components/obras/ObrasLista";
import { FuncionariosLista } from "@/components/funcionarios/FuncionariosLista";
import { FornecedoresLista } from "@/components/fornecedores/FornecedoresLista";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAcesso } from "@/components/layout/AcessoContext";
import { useStatusPlano } from "@/components/layout/StatusPlanoContext";
import { cn } from "@/lib/cn";

type Aba = "obras" | "funcionarios" | "fornecedores";

// Cada aba é um módulo: o funcionário só vê as abas que o dono liberou.
const MODULO_DA_ABA = { obras: "projetos", funcionarios: "funcionarios", fornecedores: "fornecedores" } as const;

const rotulos: Record<Aba, string> = {
  obras: "Projetos",
  funcionarios: "Funcionários",
  fornecedores: "Fornecedores",
};

// Fornecedores tem seu próprio botão "+ Novo" (abre modal, ver FornecedoresLista) — o header só cobre obras/funcionários.
const hrefsNovo: Record<"obras" | "funcionarios", string> = {
  obras: "/obras/novo",
  funcionarios: "/funcionarios/novo",
};

const rotulosNovo: Record<"obras" | "funcionarios", string> = {
  obras: "+ Novo projeto",
  funcionarios: "+ Novo funcionário",
};

export default function CadastroPage() {
  const [escolhida, setAba] = useState<Aba>("obras");
  const { somenteLeitura } = useStatusPlano();
  const { pode } = useAcesso();
  const abas = (["obras", "funcionarios", "fornecedores"] as const).filter((a) => pode(MODULO_DA_ABA[a]));
  const aba: Aba = abas.includes(escolhida) ? escolhida : (abas[0] ?? "obras");

  return (
    <div className="animar-entrada">
      <PageHeader
        titulo="Cadastro"
        acao={
          aba === "fornecedores" ? undefined : somenteLeitura ? (
            <Button tamanho="sm" disabled title="Somente leitura: seu teste ou assinatura não está ativo. Os dados continuam disponíveis para consulta.">
              {rotulosNovo[aba]}
            </Button>
          ) : (
            <Link href={hrefsNovo[aba]}>
              <Button tamanho="sm">{rotulosNovo[aba]}</Button>
            </Link>
          )
        }
      />

      <div className="mb-4 inline-flex w-full rounded-lg border border-border bg-surface p-1">
        {abas.map((opcao) => (
          <button
            key={opcao}
            type="button"
            onClick={() => setAba(opcao)}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              aba === opcao ? "bg-primary text-primary-foreground" : "text-muted",
            )}
          >
            {rotulos[opcao]}
          </button>
        ))}
      </div>

      {aba === "obras" && <ObrasLista />}
      {aba === "funcionarios" && <FuncionariosLista />}
      {aba === "fornecedores" && <FornecedoresLista />}
    </div>
  );
}
