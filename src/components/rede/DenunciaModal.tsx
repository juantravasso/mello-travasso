"use client";

import { useState } from "react";
import Link from "next/link";
import type { AlvoDenuncia, TipoDenuncia } from "@/types";
import { redeRepositorio } from "@/services/data";
import { motivosParaAlvo } from "@/lib/rede/aspectos";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

export function DenunciaModal({
  alvo,
  titulo,
  aoFechar,
}: {
  alvo: AlvoDenuncia;
  titulo: string;
  aoFechar: () => void;
}) {
  const motivos = motivosParaAlvo(alvo.tipo);
  const [motivo, setMotivo] = useState<TipoDenuncia | "">("");
  const [descricao, setDescricao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviada, setEnviada] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!motivo) {
      setErro("Escolha o motivo.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const resultado = await redeRepositorio.denunciar({ alvo, motivo, descricao });
      if (!resultado.ok) {
        setErro(resultado.mensagem);
        return;
      }
      setEnviada(true);
    } catch {
      setErro("Não foi possível enviar agora. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal titulo={titulo} onFechar={aoFechar}>
      {enviada ? (
        <div className="flex flex-col gap-4">
          <p role="status" className="text-sm text-foreground">
            Recebemos a denúncia. Nossa equipe vai analisar; o conteúdo só sai do ar se a análise confirmar o problema.
            Você acompanha o andamento em Minhas denúncias.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/minha-rede/denuncias">
              <Button type="button" variante="outline">
                Minhas denúncias
              </Button>
            </Link>
            <Button type="button" variante="ghost" onClick={aoFechar}>
              Fechar
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
          <p className="text-sm text-muted">
            A denúncia não remove nada sozinha: ela vai para análise da nossa equipe, que pode pedir mais informações.
          </p>
          <Select label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value as TipoDenuncia)}>
            <option value="" disabled>
              Escolha
            </option>
            {motivos.map((m) => (
              <option key={m.chave} value={m.chave}>
                {m.rotulo}
              </option>
            ))}
          </Select>
          <Textarea
            id="denuncia-descricao"
            label="O que está errado?"
            placeholder="Explique com objetividade, para a análise ser rápida."
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            maxLength={1000}
            rows={5}
          />
          {erro && (
            <p role="alert" className="rounded-lg border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
              {erro}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={enviando || !motivo || descricao.trim().length < 10} aria-busy={enviando}>
              {enviando ? "Enviando…" : "Enviar denúncia"}
            </Button>
            <Button type="button" variante="ghost" onClick={aoFechar}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
