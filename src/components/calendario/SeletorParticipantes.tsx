"use client";

import { useEffect, useMemo, useState } from "react";
import type { ColegaItem } from "@/types";
import { calendarioRepositorio as repo } from "@/services/data";
import { normalizarBusca } from "@/lib/rede/texto";
import { Input } from "@/components/ui/Input";

/** Escolha de com quem compartilhar: usuários ativos da mesma empresa, com busca por nome ou e-mail. */
export function SeletorParticipantes({ selecionados, aoMudar }: { selecionados: string[]; aoMudar: (ids: string[]) => void }) {
  const [colegas, setColegas] = useState<ColegaItem[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    let cancelado = false;
    repo
      .colegas()
      .then((r) => {
        if (cancelado) return;
        if (r.ok) setColegas(r.dados);
        else setErro(r.mensagem);
      })
      .catch(() => {
        if (!cancelado) setErro("Não foi possível carregar os usuários da empresa.");
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const filtrados = useMemo(() => {
    if (!colegas) return [];
    const termo = normalizarBusca(busca);
    if (!termo) return colegas;
    return colegas.filter((c) => normalizarBusca(c.nome).includes(termo) || c.email.toLowerCase().includes(termo));
  }, [colegas, busca]);

  function alternar(id: string) {
    aoMudar(selecionados.includes(id) ? selecionados.filter((s) => s !== id) : [...selecionados, id]);
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-foreground">Compartilhar com</legend>
      {erro ? (
        <p role="alert" className="text-sm text-danger">
          {erro}
        </p>
      ) : !colegas ? (
        <div className="h-16 animate-pulse rounded-lg bg-surface-2" aria-busy="true" />
      ) : colegas.length === 0 ? (
        <p className="rounded-lg border border-border px-3 py-2 text-sm text-muted">
          Você é o único usuário da empresa. Quem é o responsável pela conta cria novos usuários em Configurações.
        </p>
      ) : (
        <>
          {colegas.length > 5 && <Input aria-label="Buscar usuário por nome ou e-mail" placeholder="Buscar por nome ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} />}
          <ul className="flex max-h-40 flex-col overflow-y-auto rounded-lg border border-border">
            {filtrados.length === 0 && <li className="px-3 py-2 text-sm text-muted">Nenhum usuário encontrado.</li>}
            {filtrados.map((c) => (
              <li key={c.id} className="border-b border-border last:border-0">
                <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-surface-2">
                  <input type="checkbox" checked={selecionados.includes(c.id)} onChange={() => alternar(c.id)} className="h-4 w-4 flex-shrink-0 accent-[var(--color-primary)]" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{c.nome}</span>
                    <span className="block truncate text-xs text-muted">{c.email}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">
            {selecionados.length === 0
              ? "Só você vê este compromisso. Quem for incluído o vê no próprio calendário e recebe os lembretes."
              : `${selecionados.length} ${selecionados.length === 1 ? "pessoa incluída" : "pessoas incluídas"}. Elas veem só este compromisso, não o seu calendário.`}
          </p>
        </>
      )}
    </fieldset>
  );
}
