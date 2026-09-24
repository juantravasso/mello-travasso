"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEstoque } from "@/hooks/useEstoque";
import { useStatusPlano } from "@/components/layout/StatusPlanoContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { PageHeader } from "@/components/layout/PageHeader";

export default function NovoProdutoPage() {
  const router = useRouter();
  const { criarProduto } = useEstoque();
  const { somenteLeitura } = useStatusPlano();
  const [nome, setNome] = useState("");
  const [sku, setSku] = useState("");
  const [categoria, setCategoria] = useState("");
  const [unidade, setUnidade] = useState("");
  const [estoqueMinimo, setEstoqueMinimo] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  const valido = nome.trim() !== "";

  async function salvar() {
    if (!valido) return;
    setSalvando(true);
    try {
      const produto = await criarProduto({
        nome: nome.trim(),
        sku: sku.trim() || undefined,
        categoria: categoria.trim() || undefined,
        unidade: unidade.trim() || undefined,
        estoqueMinimo: estoqueMinimo ? Number(estoqueMinimo) : undefined,
        observacao: observacao.trim() || undefined,
      });
      router.push(`/estoque/${produto.id}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl animar-entrada">
      <PageHeader titulo="Novo produto" />
      {somenteLeitura && (
        <Card className="mb-3 border-warning bg-warning-bg text-sm text-warning">
          Teste encerrado — os dados continuam disponíveis para consulta.
        </Card>
      )}
      <Card className="flex flex-col gap-3">
        <Input label="Nome do produto" value={nome} onChange={(e) => setNome(e.target.value)} />
        <Input label="SKU (opcional)" value={sku} onChange={(e) => setSku(e.target.value)} />
        <Input label="Categoria (opcional)" value={categoria} onChange={(e) => setCategoria(e.target.value)} />
        <Input label="Unidade (ex.: un, kg, saco)" value={unidade} onChange={(e) => setUnidade(e.target.value)} />
        <Input
          label="Estoque mínimo (opcional)"
          inputMode="decimal"
          value={estoqueMinimo}
          onChange={(e) => setEstoqueMinimo(e.target.value)}
        />
        <Textarea label="Observação (opcional)" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        <div className="flex gap-3 pt-2">
          <Button variante="outline" className="flex-1" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={salvar} disabled={!valido || salvando || somenteLeitura}>
            {salvando ? "Salvando…" : "Salvar produto"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
