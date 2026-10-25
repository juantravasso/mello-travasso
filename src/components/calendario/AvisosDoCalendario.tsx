"use client";

import { useEffect, useState } from "react";
import type { PreferenciasCalendario } from "@/types";
import { calendarioRepositorio as repo } from "@/services/data";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";
import { Interruptor } from "@/components/notificacoes/Interruptor";
import { InterruptorPush } from "@/components/notificacoes/InterruptorPush";

/** Faixa no topo do Calendário: liga ou desliga o aviso dos compromissos por e-mail e por notificação push. */
export function AvisosDoCalendario() {
  const [prefs, setPrefs] = useState<PreferenciasCalendario | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    repo
      .obterPreferencias()
      .then((r) => {
        if (!cancelado && r.ok) setPrefs(r.dados);
      })
      .catch(() => undefined); // sem as preferências a faixa só não mostra o e-mail; o calendário segue
    return () => {
      cancelado = true;
    };
  }, []);

  async function alternarEmail() {
    if (!prefs) return;
    const anterior = prefs;
    const proximas = { ...prefs, lembretesPorEmail: !prefs.lembretesPorEmail };
    setPrefs(proximas);
    setSalvando(true);
    setErro(null);
    try {
      const r = await repo.salvarPreferencias({ lembretesPorEmail: proximas.lembretesPorEmail, lembretesNoApp: proximas.lembretesNoApp });
      if (!r.ok) {
        setPrefs(anterior);
        setErro(r.mensagem);
      }
    } catch (e) {
      setPrefs(anterior);
      setErro(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section aria-label="Avisos dos compromissos" className="rounded-lg border border-border bg-card px-4 py-2">
      <p className="pt-1 text-xs font-semibold uppercase tracking-widest text-muted">Receber avisos dos compromissos</p>
      <div className="grid gap-x-8 sm:grid-cols-2">
        {prefs && (
          <Interruptor
            rotulo="Lembretes por e-mail"
            apoio="Um e-mail na véspera e outro no dia."
            ligado={prefs.lembretesPorEmail}
            desabilitado={salvando}
            aoAlternar={() => void alternarEmail()}
          />
        )}
        <InterruptorPush />
      </div>
      {erro && (
        <p role="alert" className="pb-1 text-sm text-danger">
          {erro}
        </p>
      )}
    </section>
  );
}
