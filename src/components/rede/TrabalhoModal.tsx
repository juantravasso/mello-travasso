"use client";

import { useState } from "react";
import type { ServicoItem, TrabalhoInput, TrabalhoItem } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

/** Formulário de um trabalho (novo ou existente). As fotos são enviadas depois, na lista. */
export function TrabalhoModal({
  trabalho,
  servicos,
  galeriasExistentes,
  aoSalvar,
  aoFechar,
}: {
  trabalho: TrabalhoItem | null;
  servicos: ServicoItem[];
  galeriasExistentes: string[];
  aoSalvar: (input: TrabalhoInput) => Promise<string | null>;
  aoFechar: () => void;
}) {
  const [titulo, setTitulo] = useState(trabalho?.titulo ?? "");
  const [descricao, setDescricao] = useState(trabalho?.descricao ?? "");
  const [servicoId, setServicoId] = useState(trabalho?.servicoId ?? "");
  const [galeria, setGaleria] = useState(trabalho?.galeria ?? "");
  const [dataTrabalho, setDataTrabalho] = useState(trabalho?.dataTrabalho ?? "");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setErro(null);
    const mensagem = await aoSalvar({
      titulo,
      descricao: descricao || undefined,
      servicoId: servicoId || undefined,
      galeria: galeria || undefined,
      dataTrabalho: dataTrabalho || undefined,
    });
    setEnviando(false);
    if (mensagem) setErro(mensagem);
  }

  return (
    <Modal titulo={trabalho ? "Editar trabalho" : "Novo trabalho"} onFechar={aoFechar} tamanho="lg">
      <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
        <Input id="trabalho-titulo" label="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={80} required />
        <Textarea
          id="trabalho-descricao"
          label="Descrição (opcional)"
          placeholder="O que foi feito, tamanho da obra, prazo."
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          maxLength={1000}
          rows={4}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select id="trabalho-servico" label="Serviço realizado" value={servicoId} onChange={(e) => setServicoId(e.target.value)}>
            <option value="">Nenhum em especial</option>
            {servicos.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </Select>
          <Input
            id="trabalho-data"
            type="date"
            label="Data (opcional)"
            value={dataTrabalho}
            onChange={(e) => setDataTrabalho(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Input
            id="trabalho-galeria"
            label="Galeria (opcional)"
            placeholder="Ex.: Instalação elétrica, Reforma, Obra residencial"
            value={galeria}
            onChange={(e) => setGaleria(e.target.value)}
            maxLength={60}
            list="galerias-existentes"
          />
          <datalist id="galerias-existentes">
            {galeriasExistentes.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
          <p className="text-xs text-muted">Trabalhos com a mesma galeria aparecem juntos no seu perfil.</p>
        </div>
        {erro && (
          <p role="alert" className="rounded-lg border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
            {erro}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={enviando || titulo.trim().length < 2} aria-busy={enviando}>
            {enviando ? "Salvando…" : "Salvar trabalho"}
          </Button>
          <Button type="button" variante="ghost" onClick={aoFechar}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
