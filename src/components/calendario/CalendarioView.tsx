"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CompromissoItem } from "@/types";
import { calendarioRepositorio as repo } from "@/services/data";
import { listarContasNoCalendario } from "@/services/data/server/contasActions";
import { deslocarCursor, intervaloDaVisao, rotuloDoPeriodo, type Visao } from "@/lib/calendario/grade";
import { cn } from "@/lib/cn";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";
import { Button } from "@/components/ui/Button";
import { AvisosDoCalendario } from "./AvisosDoCalendario";
import { CompromissoModal } from "./CompromissoModal";
import { DetalheCompromisso } from "./DetalheCompromisso";
import { ProximosCompromissos } from "./ProximosCompromissos";
import { GradeMensal, VisaoDia, VisaoSemana } from "./VisoesCalendario";

const VISOES: { valor: Visao; rotulo: string }[] = [
  { valor: "mes", rotulo: "Mês" },
  { valor: "semana", rotulo: "Semana" },
  { valor: "dia", rotulo: "Dia" },
];

/** Mesma ordem do servidor: dia, dia inteiro primeiro, horário, título. */
function ordenar(itens: CompromissoItem[]): CompromissoItem[] {
  return [...itens].sort((a, b) => a.data.localeCompare(b.data) || (a.horaInicio ?? "").localeCompare(b.horaInicio ?? "") || a.titulo.localeCompare(b.titulo, "pt-BR"));
}

type Aberto = { tipo: "detalhe"; c: CompromissoItem } | { tipo: "formulario"; c?: CompromissoItem } | null;

export function CalendarioView({ hojeInicial, eventoInicial }: { hojeInicial: string; eventoInicial?: string }) {
  const router = useRouter();
  const [visao, setVisao] = useState<Visao>("mes");
  const [cursor, setCursor] = useState(hojeInicial);
  const [hoje, setHoje] = useState(hojeInicial);
  const [itens, setItens] = useState<CompromissoItem[]>([]);
  const [proximos, setProximos] = useState<CompromissoItem[] | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<Aberto>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const requisicao = useRef(0);

  const carregarPeriodo = useCallback(async () => {
    const numero = ++requisicao.current;
    setCarregando(true);
    setErro(null);
    try {
      const { de, ate } = intervaloDaVisao(visao, cursor);
      // As contas em aberto do período entram junto, no dia do vencimento. Se não der para lê-las (sem acesso, falha de
      // rede), o calendário segue só com os compromissos.
      const [r, contas] = await Promise.all([repo.listar(de, ate), listarContasNoCalendario(de, ate).catch(() => [])]);
      if (numero !== requisicao.current) return; // chegou uma resposta mais nova
      if (!r.ok) {
        setErro(r.mensagem);
        return;
      }
      setItens(ordenar([...r.dados.itens, ...contas]));
      setHoje(r.dados.hoje);
    } catch (e) {
      if (numero === requisicao.current) setErro(mensagemDeErro(e));
    } finally {
      if (numero === requisicao.current) setCarregando(false);
    }
  }, [visao, cursor]);

  const carregarProximos = useCallback(async () => {
    try {
      const r = await repo.proximos(8);
      if (r.ok) setProximos(r.dados);
    } catch {
      // A lista lateral é um complemento: se falhar, a grade segue funcionando.
    }
  }, []);

  useEffect(() => {
    carregarPeriodo();
  }, [carregarPeriodo]);

  useEffect(() => {
    carregarProximos();
  }, [carregarProximos]);

  // Link de lembrete (e-mail ou notificação): abre o compromisso e leva o calendário até o dia dele.
  useEffect(() => {
    if (!eventoInicial) return;
    let cancelado = false;
    repo
      .obter(eventoInicial)
      .then((r) => {
        if (cancelado) return;
        if (r.ok) {
          setCursor(r.dados.data);
          setAberto({ tipo: "detalhe", c: r.dados });
        } else {
          setAviso("Esse compromisso não existe mais ou você não tem acesso a ele.");
        }
      })
      .catch(() => {
        if (!cancelado) setAviso("Não foi possível abrir o compromisso agora.");
      });
    return () => {
      cancelado = true;
    };
  }, [eventoInicial]);

  function fecharModal() {
    setAberto(null);
    // Tira ?evento= da barra: recarregar a página não reabre o compromisso.
    if (eventoInicial) router.replace("/calendario");
  }

  /** Mostra na hora o que o servidor devolveu e confere com ele em seguida (sem esperar a recarga). */
  function aposSalvar(salvo: CompromissoItem) {
    const { de, ate } = intervaloDaVisao(visao, cursor);
    setItens((atuais) => {
      const semEste = atuais.filter((c) => c.id !== salvo.id);
      return salvo.data >= de && salvo.data <= ate ? ordenar([...semEste, salvo]) : semEste;
    });
    aposAlterar();
  }

  function aposAlterar() {
    setAberto(null);
    carregarPeriodo();
    carregarProximos();
    if (eventoInicial) router.replace("/calendario");
  }

  function abrirDetalhe(c: CompromissoItem) {
    // Conta a pagar/receber: abre a própria conta (o calendário só lembra do vencimento).
    if (c.conta) {
      router.push(c.conta.href);
      return;
    }
    setAberto({ tipo: "detalhe", c });
  }

  const dataParaNovo = visao === "dia" ? cursor : cursor.slice(0, 7) === hoje.slice(0, 7) ? hoje : cursor;
  const periodo = intervaloDaVisao(visao, cursor);
  const itensDoDia = itens.filter((c) => c.data === cursor);

  return (
    <div className="flex flex-col gap-4 animar-entrada">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-foreground">Calendário</h1>
        <Button type="button" onClick={() => setAberto({ tipo: "formulario" })}>
          + Novo compromisso
        </Button>
      </div>

      <AvisosDoCalendario />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button type="button" variante="outline" tamanho="sm" onClick={() => setCursor(hoje)}>
            Hoje
          </Button>
          <Button type="button" variante="ghost" tamanho="sm" aria-label="Período anterior" onClick={() => setCursor(deslocarCursor(visao, cursor, -1))}>
            ‹
          </Button>
          <Button type="button" variante="ghost" tamanho="sm" aria-label="Próximo período" onClick={() => setCursor(deslocarCursor(visao, cursor, 1))}>
            ›
          </Button>
        </div>
        <p className="order-last basis-full text-base font-medium text-foreground first-letter:uppercase sm:order-none sm:min-w-0 sm:flex-1 sm:basis-auto" aria-live="polite">
          {rotuloDoPeriodo(visao, cursor)}
        </p>
        <div role="group" aria-label="Visualização" className="ml-auto flex rounded-lg border border-border p-0.5">
          {VISOES.map((v) => (
            <button
              key={v.valor}
              type="button"
              aria-pressed={visao === v.valor}
              onClick={() => setVisao(v.valor)}
              className={cn("h-8 rounded-md px-3 text-sm font-medium transition-colors", visao === v.valor ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground")}
            >
              {v.rotulo}
            </button>
          ))}
        </div>
      </div>

      {aviso && (
        <p role="status" className="rounded-lg border border-warning bg-warning-bg px-3 py-2 text-sm text-warning">
          {aviso}
        </p>
      )}
      {erro && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
          <span>{erro}</span>
          <Button type="button" tamanho="sm" variante="outline" onClick={carregarPeriodo}>
            Tentar de novo
          </Button>
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_18rem]">
        <div className={cn("min-w-0 transition-opacity", carregando && "opacity-60")} aria-busy={carregando}>
          {visao === "mes" && <GradeMensal cursor={cursor} hoje={hoje} itens={itens} aoAbrir={abrirDetalhe} aoIrParaDia={(d) => { setCursor(d); setVisao("dia"); }} />}
          {visao === "semana" && <VisaoSemana cursor={cursor} hoje={hoje} itens={itens} aoAbrir={abrirDetalhe} aoIrParaDia={(d) => { setCursor(d); setVisao("dia"); }} />}
          {visao === "dia" && <VisaoDia cursor={cursor} itens={itensDoDia} aoAbrir={abrirDetalhe} aoCriar={() => setAberto({ tipo: "formulario" })} />}
          {!carregando && !erro && itens.length === 0 && visao !== "dia" && (
            <p className="mt-3 text-sm text-muted">Nenhum compromisso entre {periodo.de.split("-").reverse().join("/")} e {periodo.ate.split("-").reverse().join("/")}.</p>
          )}
        </div>
        <ProximosCompromissos itens={proximos} hoje={hoje} carregando={carregando} aoAbrir={abrirDetalhe} />
      </div>

      {aberto?.tipo === "detalhe" && (
        <DetalheCompromisso compromisso={aberto.c} aoFechar={fecharModal} aoEditar={() => setAberto({ tipo: "formulario", c: aberto.c })} aoAlterar={aposAlterar} />
      )}
      {aberto?.tipo === "formulario" && <CompromissoModal existente={aberto.c} dataInicial={dataParaNovo} aoFechar={fecharModal} aoSalvar={aposSalvar} />}
    </div>
  );
}
