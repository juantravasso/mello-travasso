"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { AvatarIniciais } from "@/components/rede/AvatarIniciais";
import { Button } from "@/components/ui/Button";
import { MAX_TEXTO_COMENTARIO, tempoRelativo } from "@/lib/feed";
import { apagarComentario, carregarComentarios, comentar } from "@/services/data/server/feedActions";
import type { ComentarioItem } from "@/types";

export function Comentarios({
  postagemId,
  logado,
  podeInteragir,
  aoMudarTotal,
}: {
  postagemId: string;
  logado: boolean;
  podeInteragir: boolean;
  aoMudarTotal: (total: number) => void;
}) {
  const [itens, setItens] = useState<ComentarioItem[] | null>(null);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  useEffect(() => {
    let ativo = true;
    void carregarComentarios({ id: postagemId }).then((r) => {
      if (!ativo) return;
      if (r.ok) setItens(r.dados);
      else setErro(r.mensagem);
    });
    return () => {
      ativo = false;
    };
  }, [postagemId]);

  function enviar() {
    setErro(null);
    iniciar(async () => {
      const r = await comentar({ postagemId, texto });
      if (r.ok) {
        setItens(r.dados.comentarios);
        aoMudarTotal(r.dados.comentarios.length);
        setTexto("");
      } else {
        setErro(r.mensagem);
      }
    });
  }

  function apagar(id: string) {
    iniciar(async () => {
      const r = await apagarComentario({ id });
      if (r.ok) {
        setItens((atual) => {
          const novo = (atual ?? []).filter((c) => c.id !== id);
          aoMudarTotal(novo.length);
          return novo;
        });
      } else {
        setErro(r.mensagem);
      }
    });
  }

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
      {itens === null && !erro && <p className="text-sm text-muted">Carregando comentários…</p>}
      {itens?.length === 0 && <p className="text-sm text-muted">Ninguém comentou ainda.</p>}
      {itens?.map((c) => (
        <div key={c.id} className="flex gap-2.5">
          <Link href={`/empresas/${c.autor.slug}`} className="flex-shrink-0">
            <AvatarIniciais nome={c.autor.nome} logoUrl={c.autor.logoUrl} className="h-8 w-8 rounded-full text-xs" />
          </Link>
          <div className="min-w-0 flex-1 rounded-xl bg-surface-2 px-3 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <Link href={`/empresas/${c.autor.slug}`} className="truncate text-sm font-semibold text-foreground hover:text-primary">
                {c.autor.nome}
              </Link>
              <span className="flex-shrink-0 text-xs text-muted">{tempoRelativo(c.criadoEm)}</span>
            </div>
            <p className="whitespace-pre-wrap break-words text-sm text-foreground">{c.texto}</p>
            {c.meu && (
              <button type="button" onClick={() => apagar(c.id)} disabled={pendente} className="mt-1 text-xs font-medium text-muted hover:text-danger">
                Apagar
              </button>
            )}
          </div>
        </div>
      ))}

      {podeInteragir ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={MAX_TEXTO_COMENTARIO}
            rows={2}
            placeholder="Escreva um comentário"
            aria-label="Escreva um comentário"
            className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-base text-foreground outline-none placeholder:text-muted focus:border-primary"
          />
          <div className="flex justify-end">
            <Button tamanho="sm" onClick={enviar} disabled={pendente || texto.trim().length === 0}>
              Comentar
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">
          {logado ? (
            <>
              Publique o seu perfil para comentar.{" "}
              <Link href="/minha-rede/perfil" className="font-medium text-primary underline underline-offset-2">
                Ir para o perfil
              </Link>
            </>
          ) : (
            <>
              <Link href="/login?next=/feed" className="font-medium text-primary underline underline-offset-2">
                Entre
              </Link>{" "}
              para comentar.
            </>
          )}
        </p>
      )}
      {erro && (
        <p role="alert" className="text-sm text-danger">
          {erro}
        </p>
      )}
    </div>
  );
}
