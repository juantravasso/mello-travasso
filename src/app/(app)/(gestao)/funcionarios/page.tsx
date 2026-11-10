"use client";

import Link from "next/link";
import { useState } from "react";
import { ConvitesFuncionario } from "@/components/funcionarios/ConvitesFuncionario";
import { FuncionariosLista } from "@/components/funcionarios/FuncionariosLista";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
import { useStatusPlano } from "@/components/layout/StatusPlanoContext";

export default function FuncionariosPage() {
  const { somenteLeitura } = useStatusPlano();
  // Aprovar um cadastro cria um funcionário: a troca da chave refaz a lista logo abaixo.
  const [versao, setVersao] = useState(0);
  return (
    <div className="animar-entrada">
      <PageHeader
        titulo="Funcionários"
        acao={
          <Link href="/funcionarios/novo">
            <Button tamanho="sm" variante="outline">
              Cadastrar manualmente
            </Button>
          </Link>
        }
      />
      <ConvitesFuncionario aoAprovar={() => setVersao((v) => v + 1)} somenteLeitura={somenteLeitura} />
      <FuncionariosLista key={versao} />
    </div>
  );
}
