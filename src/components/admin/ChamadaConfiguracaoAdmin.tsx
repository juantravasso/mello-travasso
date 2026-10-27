"use client";

import { useEffect, useState } from "react";
import { obterConfigChamadaAdmin, salvarConfigChamadaAdmin } from "@/services/data/server/chamadaConfiguracaoActions";
import { DIAS_DO_CONVITE, DURACAO_CHAMADA_MIN } from "@/lib/chamadaConfiguracao";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Interruptor } from "@/components/notificacoes/Interruptor";
import { PainelConfirmacao } from "./PainelConfirmacao";

interface Estado {
  ativa: boolean;
  url: string;
  convidadas: number;
  agendadas: number;
  dispensadas: number;
}

/** Liga o convite para a chamada de configuração e guarda o link da agenda (Cal.com, Calendly, Google Agenda). */
export function ChamadaConfiguracaoAdmin() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [ativa, setAtiva] = useState(false);
  const [url, setUrl] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function carregar() {
    const r = await obterConfigChamadaAdmin();
    if (!r.ok) throw new Error(r.mensagem);
    setEstado(r.dados);
    setAtiva(r.dados.ativa);
    setUrl(r.dados.url);
  }

  useEffect(() => {
    carregar().catch((e) => setErro(mensagemDeErro(e)));
  }, []);

  async function salvar(motivo: string, senha: string) {
    setOcupado(true);
    setErro(null);
    setAviso(null);
    try {
      const r = await salvarConfigChamadaAdmin({ ativa, url: url.trim() }, motivo, senha);
      if (!r.ok) {
        setErro(r.mensagem);
        return;
      }
      setConfirmando(false);
      setAviso("Salvo.");
      await carregar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  const mudou = estado !== null && (estado.ativa !== ativa || estado.url !== url.trim());

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <p className="font-medium text-foreground">Chamada de configuração de {DURACAO_CHAMADA_MIN} minutos</p>
        <p className="text-sm text-muted">
          Cada empresa criada nos últimos {DIAS_DO_CONVITE} dias vê um convite no app (e no e-mail de boas-vindas, se estiver ligado) para marcar a conversa com você, até agendar
          ou dispensar. Crie a página de agendamento com {DURACAO_CHAMADA_MIN} minutos de duração e cole o link aqui.
        </p>
      </div>
      {!estado && !erro && <div className="h-20 animate-pulse rounded-lg bg-surface-2" aria-busy="true" />}
      {estado && (
        <>
          <Interruptor rotulo="Oferecer a chamada às empresas novas" ligado={ativa} aoAlternar={() => setAtiva((v) => !v)} />
          <Input label="Link da agenda" type="url" placeholder="https://cal.com/seu-nome/20min" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={500} />
          <p className="text-xs text-muted">
            Até agora: {estado.convidadas} sem resposta · {estado.agendadas} marcaram como agendada · {estado.dispensadas} dispensaram. O app não vê a sua agenda: “agendada” é o
            que a empresa informa.
          </p>
          {confirmando ? (
            <PainelConfirmacao rotuloMotivo="Motivo da mudança" rotuloBotao="Salvar" ocupado={ocupado} aoConfirmar={(m, s) => void salvar(m, s)} aoCancelar={() => setConfirmando(false)} />
          ) : (
            <Button type="button" className="w-fit" disabled={!mudou} onClick={() => { setErro(null); setAviso(null); setConfirmando(true); }}>
              Salvar
            </Button>
          )}
        </>
      )}
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
