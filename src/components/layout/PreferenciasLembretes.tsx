"use client";

import { useEffect, useState } from "react";
import type { PreferenciasCalendario } from "@/types";
import { calendarioRepositorio as repo } from "@/services/data";
import { FUSOS_DA_EMPRESA } from "@/lib/calendario/config";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";
import { InterruptorPush } from "@/components/notificacoes/InterruptorPush";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";

/** Como o usuário recebe os lembretes do calendário e (só para o dono) o fuso horário da empresa. */
export function PreferenciasLembretes() {
  const [prefs, setPrefs] = useState<PreferenciasCalendario | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    repo
      .obterPreferencias()
      .then((r) => {
        if (cancelado) return;
        if (r.ok) setPrefs(r.dados);
        else setErro(r.mensagem);
      })
      .catch((e) => {
        if (!cancelado) setErro(mensagemDeErro(e));
      });
    return () => {
      cancelado = true;
    };
  }, []);

  async function salvar(proximas: PreferenciasCalendario, aoFalhar: PreferenciasCalendario, acao: () => ReturnType<typeof repo.salvarPreferencias>) {
    setPrefs(proximas);
    setSalvando(true);
    setErro(null);
    setAviso(null);
    try {
      const r = await acao();
      if (!r.ok) {
        setPrefs(aoFalhar);
        setErro(r.mensagem);
        return;
      }
      setAviso("Salvo.");
    } catch (e) {
      setPrefs(aoFalhar);
      setErro(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  function alternar(campo: "lembretesPorEmail" | "lembretesNoApp") {
    if (!prefs) return;
    const proximas = { ...prefs, [campo]: !prefs[campo] };
    void salvar(proximas, prefs, () => repo.salvarPreferencias({ lembretesPorEmail: proximas.lembretesPorEmail, lembretesNoApp: proximas.lembretesNoApp }));
  }

  function mudarFuso(fuso: string) {
    if (!prefs) return;
    void salvar({ ...prefs, fusoHorario: fuso }, prefs, () => repo.salvarFuso(fuso));
  }

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <p className="font-medium text-foreground">Lembretes do calendário</p>
        <p className="text-sm text-muted">Cada compromisso avisa na véspera e no dia. Escolha por onde quer receber.</p>
      </div>

      {!prefs && !erro ? (
        <div className="h-16 animate-pulse rounded-lg bg-surface-2" aria-busy="true" />
      ) : prefs ? (
        <>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-foreground">
            <input type="checkbox" checked={prefs.lembretesPorEmail} disabled={salvando} onChange={() => alternar("lembretesPorEmail")} className="h-4 w-4 accent-[var(--color-primary)]" />
            Receber lembretes por e-mail
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-foreground">
            <input type="checkbox" checked={prefs.lembretesNoApp} disabled={salvando} onChange={() => alternar("lembretesNoApp")} className="h-4 w-4 accent-[var(--color-primary)]" />
            Receber notificações no sistema (sino)
          </label>
          <InterruptorPush />
          {prefs.podeAlterarFuso ? (
            <Select id="fuso-empresa" label="Fuso horário da empresa" value={prefs.fusoHorario} disabled={salvando} onChange={(e) => mudarFuso(e.target.value)}>
              {FUSOS_DA_EMPRESA.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.rotulo}
                </option>
              ))}
            </Select>
          ) : (
            <p className="text-sm text-muted">Fuso horário da empresa: {FUSOS_DA_EMPRESA.find((f) => f.valor === prefs.fusoHorario)?.rotulo ?? prefs.fusoHorario}.</p>
          )}
          {prefs.podeAlterarFuso && <p className="text-xs text-muted">O fuso vale para os compromissos criados ou editados daqui em diante.</p>}
        </>
      ) : null}

      {erro && (
        <p role="alert" className="text-sm text-danger">
          {erro}
        </p>
      )}
      {aviso && !erro && (
        <p role="status" className="text-sm text-success">
          {aviso}
        </p>
      )}
    </Card>
  );
}
