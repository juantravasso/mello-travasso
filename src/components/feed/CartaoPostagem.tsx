"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AvatarIniciais } from "@/components/rede/AvatarIniciais";
import { IconeComentar, IconeCurtir } from "@/components/layout/icones";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/cn";
import { tempoRelativo } from "@/lib/feed";
import { alternarCurtida, apagarPostagem, denunciarPostagem } from "@/services/data/server/feedActions";
import type { PostagemItem } from "@/types";
import { Comentarios } from "./Comentarios";

const MOTIVOS = [
  { chave: "spam", rotulo: "Spam ou propaganda" },
  { chave: "conteudo_ofensivo", rotulo: "Conteúdo ofensivo" },
  { chave: "fraude", rotulo: "Golpe ou fraude" },
  { chave: "informacao_falsa", rotulo: "Informação falsa" },
  { chave: "outro", rotulo: "Outro motivo" },
] as const;

function GradeFotos({ fotos }: { fotos: PostagemItem["fotos"] }) {
  if (fotos.length === 0) return null;
  const colunas = fotos.length === 1 ? "grid-cols-1" : "grid-cols-2";
  return (
    <div className={cn("mt-3 grid gap-1 overflow-hidden rounded-xl border border-border", colunas)}>
      {fotos.map((f, i) => (
        <a
          key={f.id}
          href={f.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn("block bg-surface-2", fotos.length === 3 && i === 0 && "col-span-2")}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={f.url}
            alt={`Foto ${i + 1} da postagem`}
            loading="lazy"
            className={cn("w-full object-cover", fotos.length === 1 ? "max-h-[32rem]" : "h-48 sm:h-56")}
          />
        </a>
      ))}
    </div>
  );
}

export function CartaoPostagem({
  post,
  logado,
  podeInteragir,
  aoApagar,
}: {
  post: PostagemItem;
  logado: boolean;
  podeInteragir: boolean;
  aoApagar: (id: string) => void;
}) {
  const [curtiu, setCurtiu] = useState(post.curtiu);
  const [curtidas, setCurtidas] = useState(post.curtidas);
  const [comentarios, setComentarios] = useState(post.comentarios);
  const [abertos, setAbertos] = useState(false);
  const [denunciando, setDenunciando] = useState(false);
  const [motivo, setMotivo] = useState<(typeof MOTIVOS)[number]["chave"]>("spam");
  const [descricao, setDescricao] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function curtir() {
    if (!podeInteragir) {
      setAviso(logado ? "Publique o seu perfil no Elo Profissionais para curtir e comentar." : "Entre para curtir e comentar.");
      return;
    }
    const antes = { curtiu, curtidas };
    setCurtiu(!curtiu);
    setCurtidas(curtidas + (curtiu ? -1 : 1));
    iniciar(async () => {
      const r = await alternarCurtida({ id: post.id });
      if (r.ok) {
        setCurtiu(r.dados.curtiu);
        setCurtidas(r.dados.total);
      } else {
        setCurtiu(antes.curtiu);
        setCurtidas(antes.curtidas);
        setAviso(r.mensagem);
      }
    });
  }

  function apagar() {
    if (!window.confirm("Apagar esta postagem? Não dá para desfazer.")) return;
    iniciar(async () => {
      const r = await apagarPostagem({ id: post.id });
      if (r.ok) aoApagar(post.id);
      else setAviso(r.mensagem);
    });
  }

  function enviarDenuncia() {
    iniciar(async () => {
      const r = await denunciarPostagem({ postagemId: post.id, comentarioId: null, motivo, descricao });
      if (r.ok) {
        setDenunciando(false);
        setDescricao("");
        setAviso("Denúncia enviada. A administração vai analisar.");
      } else {
        setAviso(r.mensagem);
      }
    });
  }

  return (
    <article className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <header className="flex items-start gap-3">
        <Link href={`/empresas/${post.autor.slug}`} className="flex-shrink-0">
          <AvatarIniciais nome={post.autor.nome} logoUrl={post.autor.logoUrl} className="h-11 w-11" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <Link href={`/empresas/${post.autor.slug}`} className="truncate font-semibold text-foreground hover:text-primary">
            {post.autor.nome}
            {post.autor.verificado && (
              <span className="ml-1.5 text-xs font-medium text-success" title="Documentos conferidos pela administração">
                ✓ verificado
              </span>
            )}
          </Link>
          {post.autor.resumo && <span className="truncate text-sm text-muted">{post.autor.resumo}</span>}
          <time dateTime={post.criadoEm} className="text-xs text-muted">
            {tempoRelativo(post.criadoEm)}
          </time>
        </div>
        {post.minha ? (
          <button type="button" onClick={apagar} disabled={pendente} className="rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-surface-2 hover:text-danger">
            Apagar
          </button>
        ) : (
          logado && (
            <button
              type="button"
              onClick={() => (podeInteragir ? setDenunciando((v) => !v) : setAviso("Publique o seu perfil no Elo Profissionais para denunciar."))}
              className="rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-surface-2 hover:text-foreground"
            >
              Denunciar
            </button>
          )
        )}
      </header>

      {post.texto && <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-foreground">{post.texto}</p>}
      <GradeFotos fotos={post.fotos} />

      {(curtidas > 0 || comentarios > 0) && (
        <p className="mt-3 text-xs text-muted tabular-nums">
          {curtidas > 0 && `${curtidas} ${curtidas === 1 ? "curtida" : "curtidas"}`}
          {curtidas > 0 && comentarios > 0 && " · "}
          {comentarios > 0 && `${comentarios} ${comentarios === 1 ? "comentário" : "comentários"}`}
        </p>
      )}

      <div className="mt-2 flex gap-1 border-t border-border pt-2">
        <button
          type="button"
          onClick={curtir}
          aria-pressed={curtiu}
          className={cn(
            "flex h-10 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors hover:bg-surface-2",
            curtiu ? "text-primary" : "text-muted",
          )}
        >
          <IconeCurtir className={cn("h-5 w-5", curtiu && "fill-current")} />
          Curtir
        </button>
        <button
          type="button"
          onClick={() => setAbertos((v) => !v)}
          aria-expanded={abertos}
          className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-medium text-muted transition-colors hover:bg-surface-2"
        >
          <IconeComentar className="h-5 w-5" />
          Comentar
        </button>
      </div>

      {aviso && (
        <p role="status" className="mt-2 text-sm text-muted">
          {aviso}{" "}
          {!logado && (
            <Link href="/login?next=/feed" className="font-medium text-primary underline underline-offset-2">
              Entrar
            </Link>
          )}
        </p>
      )}

      {denunciando && (
        <div className="mt-3 flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">Motivo</span>
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value as typeof motivo)}
              className="h-10 rounded-lg border border-border bg-surface px-3 text-base text-foreground"
            >
              {MOTIVOS.map((m) => (
                <option key={m.chave} value={m.chave}>
                  {m.rotulo}
                </option>
              ))}
            </select>
          </label>
          <Textarea label="O que está errado?" value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={1000} />
          <div className="flex gap-2">
            <Button tamanho="sm" onClick={enviarDenuncia} disabled={pendente || descricao.trim().length < 10}>
              Enviar denúncia
            </Button>
            <Button tamanho="sm" variante="ghost" onClick={() => setDenunciando(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {abertos && (
        <Comentarios postagemId={post.id} logado={logado} podeInteragir={podeInteragir} aoMudarTotal={setComentarios} />
      )}
    </article>
  );
}
