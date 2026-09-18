"use client";

import { useState } from "react";
import type { FiltrosFornecedor, Fornecedor } from "@/types";
import { useFornecedores } from "@/hooks/useFornecedores";
import { fornecedoresRepositorio } from "@/services/data";
import { FornecedorCard } from "./FornecedorCard";
import { FornecedorForm } from "./FornecedorForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

export function FornecedoresLista() {
  const [filtros, setFiltros] = useState<FiltrosFornecedor>({});
  const { fornecedores, carregando, criarFornecedor, recarregar } = useFornecedores(filtros);
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [fornecedorEmEdicao, setFornecedorEmEdicao] = useState<Fornecedor | null>(null);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Card className="flex-1">
          <Input
            label="Buscar"
            placeholder="Nome ou documento"
            value={filtros.busca ?? ""}
            onChange={(e) => setFiltros({ ...filtros, busca: e.target.value || undefined })}
          />
        </Card>
        <Button tamanho="sm" onClick={() => setModalNovoAberto(true)}>
          + Novo fornecedor
        </Button>
      </div>

      {carregando && <p className="text-sm text-muted">Carregando…</p>}
      {!carregando && fornecedores.length === 0 && <p className="text-sm text-muted">Nenhum fornecedor encontrado.</p>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {fornecedores.map((fornecedor) => (
          <FornecedorCard key={fornecedor.id} fornecedor={fornecedor} onClick={() => setFornecedorEmEdicao(fornecedor)} />
        ))}
      </div>

      {modalNovoAberto && (
        <Modal titulo="Novo fornecedor" tamanho="lg" onFechar={() => setModalNovoAberto(false)}>
          <FornecedorForm
            onCancelar={() => setModalNovoAberto(false)}
            onSalvar={async (input) => {
              await criarFornecedor(input);
              setModalNovoAberto(false);
            }}
          />
        </Modal>
      )}

      {fornecedorEmEdicao && (
        <Modal titulo="Completar cadastro" tamanho="lg" onFechar={() => setFornecedorEmEdicao(null)}>
          <FornecedorForm
            fornecedor={fornecedorEmEdicao}
            onCancelar={() => setFornecedorEmEdicao(null)}
            onSalvar={async (input) => {
              await fornecedoresRepositorio.atualizar(fornecedorEmEdicao.id, input);
              await recarregar();
              setFornecedorEmEdicao(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
