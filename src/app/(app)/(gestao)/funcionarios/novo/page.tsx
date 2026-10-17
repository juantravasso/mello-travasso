"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFuncionarios } from "@/hooks/useFuncionarios";
import { useObras } from "@/hooks/useObras";
import { useStatusPlano } from "@/components/layout/StatusPlanoContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { PageHeader } from "@/components/layout/PageHeader";
import { hojeISO } from "@/lib/formatadores";

export default function NovoFuncionarioPage() {
  const router = useRouter();
  const { obras } = useObras();
  const { criarFuncionario } = useFuncionarios();
  const { somenteLeitura } = useStatusPlano();

  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [dataAdmissao, setDataAdmissao] = useState(hojeISO());
  const [obraId, setObraId] = useState("");
  const [salario, setSalario] = useState("");
  const [salvando, setSalvando] = useState(false);

  const valido = nome.trim() !== "" && cargo.trim() !== "";

  async function salvar() {
    if (!valido) return;
    setSalvando(true);
    try {
      const funcionario = await criarFuncionario({
        nome: nome.trim(),
        cargo: cargo.trim(),
        telefone: telefone.trim() || undefined,
        email: email.trim() || undefined,
        cpf: cpf.trim() || undefined,
        dataAdmissao,
        obraId: obraId || undefined,
        salario: salario ? Number(salario) : undefined,
      });
      router.push(`/funcionarios/${funcionario.id}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl animar-entrada">
      <PageHeader titulo="Novo funcionário" />
      {somenteLeitura && (
        <Card className="mb-3 border-warning bg-warning-bg text-sm text-warning">
          Teste encerrado — os dados continuam disponíveis para consulta.
        </Card>
      )}
      <Card className="flex flex-col gap-3">
        <Input label="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} />
        <Input label="Cargo/Função" value={cargo} onChange={(e) => setCargo(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          <Input label="CPF" value={cpf} onChange={(e) => setCpf(e.target.value)} />
        </div>
        <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Data de admissão" type="date" value={dataAdmissao} onChange={(e) => setDataAdmissao(e.target.value)} />
          <Input label="Salário (R$, opcional)" inputMode="decimal" value={salario} onChange={(e) => setSalario(e.target.value)} />
        </div>
        <Select label="Projeto alocado (opcional)" value={obraId} onChange={(e) => setObraId(e.target.value)}>
          <option value="">Nenhuma</option>
          {obras.map((obra) => (
            <option key={obra.id} value={obra.id}>
              {obra.nome}
            </option>
          ))}
        </Select>

        <div className="flex gap-3 pt-2">
          <Button variante="outline" className="flex-1" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={salvar} disabled={!valido || salvando || somenteLeitura}>
            {salvando ? "Salvando…" : "Salvar funcionário"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
