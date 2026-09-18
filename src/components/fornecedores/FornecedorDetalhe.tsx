"use client";

import { useEffect, useState } from "react";
import { useFornecedor } from "@/hooks/useFornecedor";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

export function FornecedorDetalhe({ fornecedorId }: { fornecedorId: string }) {
  const { fornecedor, carregando, atualizar } = useFornecedor(fornecedorId);

  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!fornecedor) return;
    setNome(fornecedor.nome);
    setDocumento(fornecedor.documento ?? "");
    setTelefone(fornecedor.telefone ?? "");
    setEmail(fornecedor.email ?? "");
    setObservacao(fornecedor.observacao ?? "");
  }, [fornecedor]);

  if (carregando) return <p className="text-sm text-muted">Carregando…</p>;
  if (!fornecedor) return <p className="text-sm text-danger">Fornecedor não encontrado.</p>;

  const valido = nome.trim() !== "";

  async function salvar() {
    if (!valido) return;
    setSalvando(true);
    try {
      await atualizar({
        nome: nome.trim(),
        documento: documento.trim() || undefined,
        telefone: telefone.trim() || undefined,
        email: email.trim() || undefined,
        observacao: observacao.trim() || undefined,
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Documento (CNPJ/CPF)" value={documento} onChange={(e) => setDocumento(e.target.value)} />
        <Input label="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
      </div>
      <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Textarea label="Observação" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
      <Button onClick={salvar} disabled={!valido || salvando}>
        {salvando ? "Salvando…" : "Salvar alterações"}
      </Button>
    </Card>
  );
}
