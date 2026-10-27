"use client";

import { useEffect, useState } from "react";
import { obterOfertaChamada, registrarCliqueChamada, responderChamada } from "@/services/data/server/chamadaConfiguracaoActions";
import { DURACAO_CHAMADA_MIN, type EstadoChamada } from "@/lib/chamadaConfiguracao";
import { MARCA } from "@/lib/marca";
import { OPERADORA } from "@/lib/operadora";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";
import { Button } from "@/components/ui/Button";

const PRIMEIRO_NOME = OPERADORA.nome.split(" ")[0];

/** O convite desta empresa: undefined enquanto carrega, null quando não há convite a mostrar. */
function useOferta() {
  const [oferta, setOferta] = useState<{ url: string } | null | undefined>(undefined);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    obterOfertaChamada()
      .then((r) => {
        if (!cancelado) setOferta(r.ok ? r.dados : null);
      })
      .catch(() => {
        if (!cancelado) setOferta(null);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  async function responder(estado: EstadoChamada) {
    setOcupado(true);
    setErro(null);
    try {
      const r = await responderChamada(estado);
      if (!r.ok) {
        setErro(r.mensagem);
        return;
      }
      setOferta(null);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  return { oferta, ocupado, erro, responder, aoAbrirAgenda: () => void registrarCliqueChamada().catch(() => undefined) };
}

/** Faixa no topo do app: convida o responsável pela conta a marcar a chamada, até ele agendar ou dispensar. */
export function FaixaChamadaConfiguracao() {
  const { oferta, ocupado, erro, responder, aoAbrirAgenda } = useOferta();
  if (!oferta) return null;
  return (
    <div role="region" aria-label="Convite para a chamada de configuração" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-primary/40 bg-primary/10 px-4 py-2.5 text-sm sm:px-8">
      <p className="min-w-0 text-foreground">
        <strong>Quer ajuda para deixar o {MARCA.nome} configurado?</strong> Marque uma conversa de {DURACAO_CHAMADA_MIN} minutos, sem custo, com {PRIMEIRO_NOME}, fundador, e configure tudo junto.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={oferta.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={aoAbrirAgenda}
          className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-primary"
        >
          Agendar {DURACAO_CHAMADA_MIN} min
        </a>
        <Button type="button" tamanho="sm" variante="outline" disabled={ocupado} onClick={() => void responder("agendada")}>
          Já agendei
        </Button>
        <Button type="button" tamanho="sm" variante="ghost" disabled={ocupado} onClick={() => void responder("dispensada")}>
          Agora não
        </Button>
      </div>
      {erro && (
        <p role="alert" className="basis-full text-xs text-danger">
          {erro}
        </p>
      )}
    </div>
  );
}

/** Versão em página (link do e-mail de boas-vindas): explica o que é a conversa e leva à agenda. */
export function CartaoChamadaConfiguracao() {
  const { oferta, ocupado, erro, responder, aoAbrirAgenda } = useOferta();
  if (oferta === undefined) return <div className="h-40 animate-pulse rounded-xl bg-surface-2" aria-busy="true" />;
  if (oferta === null) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5 text-sm">
        <p className="font-medium text-foreground">Este convite não está disponível agora.</p>
        <p className="text-muted">
          Ele aparece só para o responsável pela conta, nas primeiras semanas, e some depois que você agenda ou dispensa. Se precisar de ajuda, escreva para{" "}
          <a href={`mailto:${MARCA.emailContato}`} className="text-primary underline underline-offset-2">
            {MARCA.emailContato}
          </a>
          .
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">Uma conversa de {DURACAO_CHAMADA_MIN} minutos, sem custo, para configurar o sistema</h2>
        <p className="text-sm text-muted">
          Com {PRIMEIRO_NOME}, fundador do {MARCA.nome}. Na chamada vocês deixam pronto o que faz sentido para a sua empresa: projetos, formas de pagamento, acessos da equipe e
          o que mais você quiser perguntar. Escolha o dia e o horário na agenda.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={oferta.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={aoAbrirAgenda}
          className="inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-primary"
        >
          Escolher dia e horário
        </a>
        <Button type="button" variante="outline" disabled={ocupado} onClick={() => void responder("agendada")}>
          Já agendei
        </Button>
        <Button type="button" variante="ghost" disabled={ocupado} onClick={() => void responder("dispensada")}>
          Agora não
        </Button>
      </div>
      {erro && (
        <p role="alert" className="text-sm text-danger">
          {erro}
        </p>
      )}
    </div>
  );
}
