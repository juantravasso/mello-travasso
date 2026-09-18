"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFornecedores } from "@/hooks/useFornecedores";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { PageHeader } from "@/components/layout/PageHeader";

export default function NovoFornecedorPage() {
  const router = useRouter();
  const { criarFornecedor } = useFornecedores();

  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  const valido = nome.trim() !== "";

  async function salvar() {
    if (!valido) return;
    setSalvando(true);
    try {
      const fornecedor = await criarFornecedor({
        nome: nome.trim(),
        documento: documento.trim() || undefined,
        telefone: telefone.trim() || undefined,
        email: email.trim() || undefined,
        observacao: observacao.trim() || undefined,
      });
      router.push(`/fornecedores/${fornecedor.id}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl animar-entrada">
      <PageHeader titulo="Novo fornecedor" />
      <Card className="flex flex-col gap-3">
        <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Documento (CNPJ/CPF)" value={documento} onChange={(e) => setDocumento(e.target.value)} />
          <Input label="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
        </div>
        <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Textarea label="Observação" value={observacao} onChange={(e) => setObservacao(e.target.value)} />

        <div className="flex gap-3 pt-2">
          <Button variante="outline" className="flex-1" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={salvar} disabled={!valido || salvando}>
            {salvando ? "Salvando…" : "Salvar fornecedor"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
