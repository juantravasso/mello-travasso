"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { carregarFeed } from "@/services/data/server/feedActions";
import type { PaginaFeed, PostagemItem } from "@/types";
import { CartaoPostagem } from "./CartaoPostagem";

/** Lista do feed com paginação por cursor: carrega a próxima página ao chegar no fim (ou pelo botão). */
export function ListaFeed({
  inicial,
  logado,
  podeInteragir,
}: {
  inicial: PaginaFeed;
  logado: boolean;
  podeInteragir: boolean;
}) {
  const [itens, setItens] = useState<PostagemItem[]>(inicial.itens);
  const [proximo, setProximo] = useState<string | null>(inicial.proximo);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement | null>(null);

  const carregarMais = useCallback(async () => {
    if (!proximo || carregando) return;
    setCarregando(true);
    setErro(null);
    const r = await carregarFeed({ cursor: proximo });
    if (r.ok) {
      // Se alguém publicou entre uma página e outra, o cursor evita repetir; ainda assim descarta ids repetidos.
      setItens((atual) => {
        const vistos = new Set(atual.map((p) => p.id));
        return [...atual, ...r.dados.itens.filter((p) => !vistos.has(p.id))];
      });
      setProximo(r.dados.proximo);
    } else {
      setErro(r.mensagem);
    }
    setCarregando(false);
  }, [proximo, carregando]);

  useEffect(() => {
    const alvo = fim.current;
    if (!alvo || !proximo || erro) return;
    const observador = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) void carregarMais();
    }, { rootMargin: "400px" });
    observador.observe(alvo);
    return () => observador.disconnect();
  }, [proximo, carregarMais, erro]);

  if (itens.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center">
        <p className="font-medium text-foreground">Ainda não há postagens.</p>
        <p className="mt-1 text-sm text-muted">Seja a primeira empresa a mostrar um trabalho ou compartilhar uma novidade.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {itens.map((post) => (
        <CartaoPostagem
          key={post.id}
          post={post}
          logado={logado}
          podeInteragir={podeInteragir}
          aoApagar={(id) => setItens((atual) => atual.filter((p) => p.id !== id))}
        />
      ))}
      <div ref={fim} />
      {proximo && (
        <div className="flex justify-center">
          <Button variante="outline" onClick={() => void carregarMais()} disabled={carregando}>
            {carregando ? "Carregando…" : "Ver mais postagens"}
          </Button>
        </div>
      )}
      {erro && (
        <p role="alert" className="text-center text-sm text-danger">
          {erro}
        </p>
      )}
      {!proximo && <p className="py-4 text-center text-sm text-muted">Você viu tudo por enquanto.</p>}
    </div>
  );
}
