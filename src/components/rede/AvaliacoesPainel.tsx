"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { AvaliacaoFeita, AvaliacaoRecebida } from "@/types";
import { redeRepositorio } from "@/services/data";
import { formatarDataBr } from "@/lib/rede/texto";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/cn";
import { Aspectos } from "./AvaliacaoCard";
import { EstrelasNota } from "./EstrelasNota";

export type AbaAvaliacoes = "recebidas" | "feitas";

function SubAbas({ aba }: { aba: AbaAvaliacoes }) {
  const itens: { chave: AbaAvaliacoes; rotulo: string }[] = [
    { chave: "recebidas", rotulo: "Recebidas" },
    { chave: "feitas", rotulo: "Feitas por mim" },
  ];
  return (
    <div className="flex gap-2" role="tablist" aria-label="Avaliações">
      {itens.map((i) => (
        <Link
          key={i.chave}
          href={`/minha-rede/avaliacoes?aba=${i.chave}`}
          role="tab"
          aria-selected={aba === i.chave}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
            aba === i.chave ? "border-primary bg-primary/15 text-primary" : "border-border text-muted hover:text-foreground",
          )}
        >
          {i.rotulo}
        </Link>
      ))}
    </div>
  );
}

function Esqueleto() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      <Card className="h-28 animate-pulse bg-surface-2">{null}</Card>
      <Card className="h-28 animate-pulse bg-surface-2">{null}</Card>
    </div>
  );
}

function RecebidaCard({ avaliacao, aoResponder }: { avaliacao: AvaliacaoRecebida; aoResponder: () => Promise<void> }) {
  const [respondendo, setRespondendo] = useState(false);
  const [texto, setTexto] = useState(avaliacao.resposta?.texto ?? "");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [respondendoRelacao, setRespondendoRelacao] = useState(false);
  const [erroRelacao, setErroRelacao] = useState<string | null>(null);

  async function definirRelacao(estado: "confirmada" | "contestada") {
    setRespondendoRelacao(true);
    setErroRelacao(null);
    try {
      const resultado = await redeRepositorio.responderRelacao(avaliacao.id, estado);
      if (!resultado.ok) {
        setErroRelacao(resultado.mensagem);
        return;
      }
      await aoResponder();
    } catch {
      setErroRelacao("Não foi possível enviar agora. Tente de novo.");
    } finally {
      setRespondendoRelacao(false);
    }
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const resultado = await redeRepositorio.responderAvaliacao(avaliacao.id, texto);
      if (!resultado.ok) {
        setErro(resultado.mensagem);
        return;
      }
      setRespondendo(false);
      await aoResponder();
    } catch {
      setErro("Não foi possível enviar agora. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <EstrelasNota nota={avaliacao.nota} tamanho="sm" />
        <span className="text-sm font-medium text-foreground">{avaliacao.avaliadorNome}</span>
        <span className="text-xs text-muted">
          {formatarDataBr(avaliacao.criadoEm)}
          {avaliacao.editadaEm && <> · editada em {formatarDataBr(avaliacao.editadaEm)}</>}
        </span>
      </div>
      {avaliacao.comentario && <p className="whitespace-pre-line text-sm text-foreground/90">{avaliacao.comentario}</p>}
      <Aspectos pros={avaliacao.pros} contras={avaliacao.contras} />

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface px-3 py-2">
        <p className="text-sm text-foreground">
          {avaliacao.relacao === "confirmada"
            ? "Você confirmou que trabalhou com esta empresa. O selo “relação confirmada pelo avaliado” aparece na avaliação."
            : avaliacao.relacao === "contestada"
              ? "Você disse que não reconhece essa relação. A avaliação segue publicada, sem selo, e a moderação pode analisar."
              : "Você trabalhou com esta empresa? Confirmar dá um selo à avaliação; só confirme se foi real."}
        </p>
        <div className="flex flex-wrap gap-2">
          {avaliacao.relacao !== "confirmada" && (
            <Button type="button" tamanho="sm" variante="outline" disabled={respondendoRelacao} onClick={() => definirRelacao("confirmada")}>
              Confirmar que trabalhamos juntos
            </Button>
          )}
          {avaliacao.relacao !== "contestada" && (
            <Button type="button" tamanho="sm" variante="ghost" disabled={respondendoRelacao} onClick={() => definirRelacao("contestada")}>
              Não reconheço essa relação
            </Button>
          )}
        </div>
        {erroRelacao && (
          <p role="alert" className="text-xs text-danger">
            {erroRelacao}
          </p>
        )}
      </div>

      {avaliacao.resposta && !respondendo && (
        <div className="flex flex-col gap-1 rounded-lg border-l-2 border-primary bg-surface px-3 py-2">
          <p className="text-xs text-muted">Sua resposta · {formatarDataBr(avaliacao.resposta.criadoEm)}</p>
          <p className="whitespace-pre-line text-sm text-foreground/90">{avaliacao.resposta.texto}</p>
        </div>
      )}

      {respondendo ? (
        <form onSubmit={enviar} className="flex flex-col gap-2">
          <Textarea
            id={`resposta-${avaliacao.id}`}
            label="Sua resposta (pública, aparece junto da avaliação)"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={1500}
            rows={4}
            autoFocus
          />
          {erro && (
            <p role="alert" className="text-xs text-danger">
              {erro}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" tamanho="sm" disabled={enviando || texto.trim().length < 5} aria-busy={enviando}>
              {enviando ? "Enviando…" : "Publicar resposta"}
            </Button>
            <Button type="button" tamanho="sm" variante="ghost" onClick={() => setRespondendo(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <div>
          <Button type="button" tamanho="sm" variante="outline" onClick={() => setRespondendo(true)}>
            {avaliacao.resposta ? "Editar resposta" : "Responder"}
          </Button>
        </div>
      )}
    </Card>
  );
}

function Recebidas() {
  const [itens, setItens] = useState<AvaliacaoRecebida[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setItens(await redeRepositorio.listarAvaliacoesRecebidas());
  }, []);

  useEffect(() => {
    carregar().catch(() => setErro("Não foi possível carregar agora. Tente de novo."));
  }, [carregar]);

  if (erro) return <Card role="alert" className="border-danger bg-danger-bg text-sm text-danger">{erro}</Card>;
  if (!itens) return <Esqueleto />;
  if (itens.length === 0) {
    return (
      <Card className="text-sm text-muted">
        Você ainda não recebeu avaliações. Publique seu perfil e compartilhe o endereço dele com seus clientes.
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {itens.map((a) => (
        <RecebidaCard key={a.id} avaliacao={a} aoResponder={carregar} />
      ))}
    </div>
  );
}

function Feitas() {
  const [itens, setItens] = useState<AvaliacaoFeita[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    redeRepositorio
      .listarAvaliacoesFeitas()
      .then(setItens)
      .catch(() => setErro("Não foi possível carregar agora. Tente de novo."));
  }, []);

  if (erro) return <Card role="alert" className="border-danger bg-danger-bg text-sm text-danger">{erro}</Card>;
  if (!itens) return <Esqueleto />;
  if (itens.length === 0) {
    return (
      <Card className="flex flex-col gap-2 text-sm text-muted">
        <p>Você ainda não avaliou ninguém.</p>
        <Link href="/rede" className="w-fit font-medium text-primary underline underline-offset-4">
          Encontrar quem você contratou
        </Link>
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {itens.map((a) => (
        <Card key={a.id} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <EstrelasNota nota={a.nota} tamanho="sm" />
            <Link href={`/empresas/${a.perfilSlug}`} className="text-sm font-medium text-foreground hover:text-primary">
              {a.perfilNome}
            </Link>
            <span className="text-xs text-muted">
              {formatarDataBr(a.criadoEm)}
              {a.editadaEm && <> · editada em {formatarDataBr(a.editadaEm)}</>}
            </span>
          </div>
          {a.status !== "publicada" && (
            <p role="status" className="rounded-lg border border-warning bg-warning-bg px-3 py-2 text-sm text-warning">
              {a.status === "oculta"
                ? "Esta avaliação está oculta pela moderação e não aparece para o público."
                : "Esta avaliação foi removida pela moderação."}
            </p>
          )}
          {a.comentario && <p className="whitespace-pre-line text-sm text-foreground/90">{a.comentario}</p>}
          <Aspectos pros={a.pros} contras={a.contras} />
          {a.resposta && (
            <div className="flex flex-col gap-1 rounded-lg border-l-2 border-primary bg-surface px-3 py-2">
              <p className="text-xs text-muted">
                Resposta de {a.resposta.autorNome} · {formatarDataBr(a.resposta.criadoEm)}
                {a.resposta.editadaEm && <> · editada em {formatarDataBr(a.resposta.editadaEm)}</>}
              </p>
              <p className="whitespace-pre-line text-sm text-foreground/90">{a.resposta.texto}</p>
            </div>
          )}
          {a.status === "publicada" && (
            <div>
              <Link href={`/minha-rede/avaliar/${a.perfilSlug}`}>
                <Button type="button" tamanho="sm" variante="outline">
                  Editar avaliação
                </Button>
              </Link>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

export function AvaliacoesPainel({ aba }: { aba: AbaAvaliacoes }) {
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <SubAbas aba={aba} />
      {aba === "recebidas" ? <Recebidas /> : <Feitas />}
    </div>
  );
}
