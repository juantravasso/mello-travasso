"use client";

import { useState } from "react";
import type { CategoriaGasto, NovaContaFinanceiraInput, Obra, TipoConta } from "@/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { categorias, rotulosCategoria } from "@/lib/categorias";
import { hojeISO } from "@/lib/formatadores";
import { blobParaDataUrl } from "@/lib/imagem";

interface ContaFormProps {
  tipo: TipoConta;
  obras: Obra[];
  onSalvar: (input: NovaContaFinanceiraInput) => Promise<void>;
  onCancelar: () => void;
}

export function ContaForm({ tipo, obras, onSalvar, onCancelar }: ContaFormProps) {
  const [obraId, setObraId] = useState(obras[0]?.id ?? "");
  const [valor, setValor] = useState("");
  const [dataVencimento, setDataVencimento] = useState(hojeISO());
  const [favorecidoOuCliente, setFavorecidoOuCliente] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState<CategoriaGasto>("material");
  const [comprovanteUrl, setComprovanteUrl] = useState("");
  const [salvando, setSalvando] = useState(false);

  const valido = Number(valor) > 0 && obraId !== "" && favorecidoOuCliente.trim() !== "";

  async function aoSelecionarComprovante(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (arquivo) setComprovanteUrl(await blobParaDataUrl(arquivo));
  }

  async function submeter() {
    if (!valido) return;
    setSalvando(true);
    try {
      await onSalvar({
        tipo,
        obraId,
        valor: Number(valor),
        dataVencimento,
        favorecidoOuCliente: favorecidoOuCliente.trim(),
        descricao: descricao.trim(),
        categoria: tipo === "pagar" ? categoria : undefined,
        comprovanteUrl,
        origemNotaFiscal: false,
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <Select label="Obra" value={obraId} onChange={(e) => setObraId(e.target.value)}>
        <option value="" disabled>
          Selecione a obra
        </option>
        {obras.map((obra) => (
          <option key={obra.id} value={obra.id}>
            {obra.nome}
          </option>
        ))}
      </Select>
      <Input
        label={tipo === "pagar" ? "Fornecedor/Favorecido" : "Cliente"}
        value={favorecidoOuCliente}
        onChange={(e) => setFavorecidoOuCliente(e.target.value)}
      />
      <Input label="Valor (R$)" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
      <Input
        label={tipo === "pagar" ? "Data de vencimento" : "Data prevista"}
        type="date"
        value={dataVencimento}
        onChange={(e) => setDataVencimento(e.target.value)}
      />
      <Textarea label="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      {tipo === "pagar" && (
        <Select label="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaGasto)}>
          {categorias.map((c) => (
            <option key={c} value={c}>
              {rotulosCategoria[c]}
            </option>
          ))}
        </Select>
      )}
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-foreground">Comprovante (opcional)</span>
        <input type="file" accept="image/*" onChange={aoSelecionarComprovante} className="text-sm" />
      </label>

      <div className="flex gap-3 pt-2">
        <Button variante="outline" className="flex-1" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </Button>
        <Button className="flex-1" onClick={submeter} disabled={!valido || salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </Card>
  );
}
