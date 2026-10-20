"use client";

import { useCallback, useEffect, useState } from "react";
import type { ConfigCicloDeVida, HistoricoTesteAdmin, PainelCicloDeVidaAdmin, TesteDaEmpresaAdmin } from "@/types";
import {
  estenderTesteDaEmpresa,
  obterHistoricoDoTeste,
  obterPainelCicloDeVida,
  salvarConfigCicloDeVida,
} from "@/services/data/server/cicloDeVidaAdminActions";
import { formatarDataCompleta } from "@/lib/cicloDeVida/datas";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PainelConfirmacao } from "./PainelConfirmacao";

const data = (iso: string | null) => (iso ? formatarDataCompleta(new Date(iso)) : "—");

const ROTULO_STATUS: Record<string, string> = { pendente: "Na fila", enviado: "Enviados", falhou: "Falharam", cancelado: "Cancelados" };

const ROTULO_CAMPANHA: Record<string, string> = {
  boas_vindas: "Boas-vindas",
  primeira_acao: "Dica: primeira ação",
  problema: "Dica: problema do dia a dia",
  recursos: "Recursos não usados",
  fim_do_teste: "Fim do teste",
  teste_estendido: "Teste estendido",
};

function semChave<T>(registro: Record<string, T>, chave: string): Record<string, T> {
  return Object.fromEntries(Object.entries(registro).filter(([k]) => k !== chave));
}

function Chave({ rotulo, ligado, aoMudar, descricao }: { rotulo: string; ligado: boolean; aoMudar: (v: boolean) => void; descricao?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div>
        <p className="text-sm font-medium text-foreground">{rotulo}</p>
        {descricao && <p className="text-xs text-muted">{descricao}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={ligado}
        aria-label={rotulo}
        onClick={() => aoMudar(!ligado)}
        className={cn("relative h-6 w-11 flex-shrink-0 rounded-full border border-border transition-colors", ligado ? "bg-primary" : "bg-surface-2")}
      >
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", ligado ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );
}

function Numero({ rotulo, valor, min, max, aoMudar }: { rotulo: string; valor: number; min: number; max: number; aoMudar: (n: number) => void }) {
  return (
    <Input
      type="number"
      inputMode="numeric"
      label={rotulo}
      min={min}
      max={max}
      value={Number.isFinite(valor) ? valor : ""}
      onChange={(e) => aoMudar(e.target.value === "" ? Number.NaN : Number(e.target.value))}
      className="max-w-32 tabular-nums"
    />
  );
}

/** Administração do teste de 14 dias e dos e-mails de ciclo de vida. Só o admin chega aqui; cada ação confere de novo no servidor. */
export function CicloDeVidaAdmin() {
  const [painel, setPainel] = useState<PainelCicloDeVidaAdmin | null>(null);
  const [rascunho, setRascunho] = useState<ConfigCicloDeVida | null>(null);
  const [diasAntesTexto, setDiasAntesTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmandoConfig, setConfirmandoConfig] = useState(false);
  const [estendendo, setEstendendo] = useState<string | null>(null);
  const [diasExtensao, setDiasExtensao] = useState(7);
  const [historicos, setHistoricos] = useState<Record<string, HistoricoTesteAdmin>>({});

  const carregar = useCallback(async () => {
    const r = await obterPainelCicloDeVida();
    if (!r.ok) throw new Error(r.mensagem);
    setPainel(r.dados);
    setRascunho(r.dados.config);
    setDiasAntesTexto(r.dados.config.emails.fimDoTeste.diasAntes.join(", "));
  }, []);

  useEffect(() => {
    carregar().catch((e) => setErro(mensagemDeErro(e)));
  }, [carregar]);

  function mudar(fn: (c: ConfigCicloDeVida) => ConfigCicloDeVida) {
    setRascunho((atual) => (atual ? fn(atual) : atual));
  }

  async function salvarConfig(motivo: string, senha: string) {
    if (!rascunho) return;
    const diasAntes = diasAntesTexto
      .split(/[,\s]+/)
      .filter(Boolean)
      .map(Number);
    setOcupado(true);
    setErro(null);
    try {
      const r = await salvarConfigCicloDeVida({ ...rascunho, emails: { ...rascunho.emails, fimDoTeste: { ...rascunho.emails.fimDoTeste, diasAntes } } }, motivo, senha);
      if (!r.ok) {
        setErro(r.mensagem);
        return;
      }
      setConfirmandoConfig(false);
      setAviso("Configuração salva.");
      await carregar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  async function estender(t: TesteDaEmpresaAdmin, motivo: string, senha: string) {
    setOcupado(true);
    setErro(null);
    try {
      const r = await estenderTesteDaEmpresa(t.empresaId, diasExtensao, motivo, senha);
      if (!r.ok) {
        setErro(r.mensagem);
        return;
      }
      setEstendendo(null);
      setAviso(`Teste de ${t.nome} estendido até ${data(r.dados.fimNovo)}.`);
      setHistoricos((atual) => semChave(atual, t.empresaId));
      await carregar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  async function alternarHistorico(empresaId: string) {
    if (historicos[empresaId]) {
      setHistoricos((atual) => semChave(atual, empresaId));
      return;
    }
    try {
      const r = await obterHistoricoDoTeste(empresaId);
      if (!r.ok) throw new Error(r.mensagem);
      setHistoricos((atual) => ({ ...atual, [empresaId]: r.dados }));
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  if (!painel || !rascunho) {
    return erro ? (
      <p role="alert" className="text-sm text-danger">
        {erro}
      </p>
    ) : (
      <p className="text-sm text-muted">Carregando…</p>
    );
  }

  const emails = rascunho.emails;
  return (
    <div className="flex flex-col gap-4">
      {erro && (
        <p role="alert" className="rounded-lg border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
          {erro}
        </p>
      )}
      {aviso && (
        <p role="status" className="rounded-lg border border-success bg-success-bg px-3 py-2 text-sm text-success">
          {aviso}
        </p>
      )}

      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="font-semibold text-foreground">Configuração</h2>
          <p className="text-sm text-muted">
            Vale para novos testes e para os próximos envios. Quem já está em teste mantém a data que tem. Cada alteração entra no registro de ações.
          </p>
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <p className="text-sm font-medium text-foreground">Teste</p>
          <Numero rotulo="Duração do teste (dias)" valor={rascunho.testeDias} min={1} max={90} aoMudar={(n) => mudar((c) => ({ ...c, testeDias: n }))} />
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <Chave rotulo="Permitir extensão do teste" ligado={rascunho.extensao.ativa} aoMudar={(v) => mudar((c) => ({ ...c, extensao: { ...c.extensao, ativa: v } }))} descricao="Só a administração concede, com motivo e senha. Nunca é automática." />
          <div className="flex flex-wrap gap-4">
            <Numero rotulo="Extensões por empresa" valor={rascunho.extensao.maxExtensoes} min={0} max={5} aoMudar={(n) => mudar((c) => ({ ...c, extensao: { ...c.extensao, maxExtensoes: n } }))} />
            <Numero rotulo="Dias por extensão (máx.)" valor={rascunho.extensao.maxDiasPorExtensao} min={1} max={60} aoMudar={(n) => mudar((c) => ({ ...c, extensao: { ...c.extensao, maxDiasPorExtensao: n } }))} />
            <Numero rotulo="Dias estendidos no total (máx.)" valor={rascunho.extensao.maxDiasTotal} min={1} max={120} aoMudar={(n) => mudar((c) => ({ ...c, extensao: { ...c.extensao, maxDiasTotal: n } }))} />
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <Chave
            rotulo="Enviar e-mails de ciclo de vida"
            ligado={emails.ativos}
            aoMudar={(v) => mudar((c) => ({ ...c, emails: { ...c.emails, ativos: v } }))}
            descricao={
              emails.ativadoEm
                ? `Ligados em ${data(emails.ativadoEm)}. Dicas e boas-vindas só valem para quem se cadastrou depois disso.`
                : "Desligado: nada é enviado. Ao ligar, dicas e boas-vindas valem só para quem se cadastrar daí em diante."
            }
          />
          <Chave rotulo="Boas-vindas (após confirmar o e-mail)" ligado={emails.boasVindas.ativa} aoMudar={(v) => mudar((c) => ({ ...c, emails: { ...c.emails, boasVindas: { ativa: v } } }))} />
          {(
            [
              ["primeiraAcao", "Dica: primeira ação"],
              ["problema", "Dica: problema do dia a dia"],
              ["recursos", "Recursos ainda não usados"],
            ] as const
          ).map(([chave, rotulo]) => (
            <div key={chave} className="flex flex-wrap items-end gap-4">
              <div className="min-w-56 flex-1">
                <Chave rotulo={rotulo} ligado={emails[chave].ativa} aoMudar={(v) => mudar((c) => ({ ...c, emails: { ...c.emails, [chave]: { ...c.emails[chave], ativa: v } } }))} descricao="Só sai se a pessoa ainda não fez a ação ensinada." />
              </div>
              <Numero rotulo="Dias após o cadastro" valor={emails[chave].aposDias} min={1} max={30} aoMudar={(n) => mudar((c) => ({ ...c, emails: { ...c.emails, [chave]: { ...c.emails[chave], aposDias: n } } }))} />
            </div>
          ))}
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-56 flex-1">
              <Chave rotulo="Avisos de fim do teste (e-mail e no app)" ligado={emails.fimDoTeste.ativa} aoMudar={(v) => mudar((c) => ({ ...c, emails: { ...c.emails, fimDoTeste: { ...c.emails.fimDoTeste, ativa: v } } }))} descricao="Avisos sobre a conta: sempre chegam, mesmo para quem parou de receber dicas." />
            </div>
            <Input label="Dias antes do fim (0 = no dia)" value={diasAntesTexto} onChange={(e) => setDiasAntesTexto(e.target.value)} className="max-w-40" placeholder="3, 1, 0" />
          </div>
        </div>

        {confirmandoConfig ? (
          <PainelConfirmacao rotuloMotivo="Motivo da alteração" rotuloBotao="Salvar configuração" ocupado={ocupado} aoConfirmar={salvarConfig} aoCancelar={() => setConfirmandoConfig(false)} />
        ) : (
          <div>
            <Button type="button" tamanho="sm" onClick={() => setConfirmandoConfig(true)}>
              Salvar configuração…
            </Button>
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-foreground">Testes perto do fim</h2>
          <p className="text-sm text-muted">Empresas cujo teste termina nos próximos 14 dias ou terminou na última semana.</p>
        </div>
        {painel.testes.length === 0 && <p className="text-sm text-muted">Nenhum teste nessa janela.</p>}
        <ul className="flex flex-col divide-y divide-border">
          {painel.testes.map((t) => (
            <li key={t.empresaId} className="flex flex-col gap-2 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{t.nome}</p>
                  <p className="text-sm text-muted">
                    {t.encerrado ? "Encerrado em" : "Termina em"} <span className="tabular-nums">{data(t.fimAtual)}</span>
                    {t.extensoes > 0 && (
                      <>
                        {" "}
                        · original <span className="tabular-nums">{data(t.fimOriginal)}</span> · {t.extensoes} extensão(ões), {t.diasEstendidos} dia(s)
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tom={t.encerrado ? "danger" : (t.diasRestantes ?? 99) <= 3 ? "warning" : "neutral"}>
                    {t.encerrado ? "Encerrado" : `${t.diasRestantes} dia(s)`}
                  </Badge>
                  <Button type="button" tamanho="sm" variante="outline" onClick={() => alternarHistorico(t.empresaId)}>
                    {historicos[t.empresaId] ? "Ocultar histórico" : "Histórico"}
                  </Button>
                  <Button type="button" tamanho="sm" variante="outline" onClick={() => setEstendendo(estendendo === t.empresaId ? null : t.empresaId)}>
                    Estender
                  </Button>
                </div>
              </div>
              {historicos[t.empresaId] && (
                <div className="rounded-lg bg-surface-2 p-3 text-sm">
                  <p className="text-muted">
                    Fim original: <span className="tabular-nums text-foreground">{data(historicos[t.empresaId]!.fimOriginal)}</span> · fim atual:{" "}
                    <span className="tabular-nums text-foreground">{data(historicos[t.empresaId]!.fimAtual)}</span>
                  </p>
                  {historicos[t.empresaId]!.extensoes.length === 0 ? (
                    <p className="mt-1 text-muted">Nenhuma extensão concedida.</p>
                  ) : (
                    <ul className="mt-2 flex flex-col gap-1">
                      {historicos[t.empresaId]!.extensoes.map((x) => (
                        <li key={x.id} className="text-foreground">
                          <span className="tabular-nums">{data(x.criadoEm)}</span> · +{x.dias} dia(s) · até <span className="tabular-nums">{data(x.fimNovo)}</span> · por {x.concedidaPor}
                          <span className="block text-muted">Motivo: {x.motivo}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {estendendo === t.empresaId && (
                <div className="flex flex-col gap-2">
                  <Numero rotulo="Estender por quantos dias?" valor={diasExtensao} min={1} max={painel.config.extensao.maxDiasPorExtensao} aoMudar={setDiasExtensao} />
                  <PainelConfirmacao rotuloMotivo="Motivo da extensão" rotuloBotao={`Estender ${Number.isFinite(diasExtensao) ? diasExtensao : "?"} dia(s)`} ocupado={ocupado} aoConfirmar={(motivo, senha) => estender(t, motivo, senha)} aoCancelar={() => setEstendendo(null)} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-foreground">Quem está começando</h2>
          <p className="text-sm text-muted">Donos cadastrados nos últimos 14 dias e o que já fizeram. Quem não tem nada marcado está parado.</p>
        </div>
        {painel.onboarding.length === 0 && <p className="text-sm text-muted">Nenhum cadastro recente.</p>}
        <ul className="flex flex-col divide-y divide-border">
          {painel.onboarding.map((o) => (
            <li key={o.empresaId} className="flex flex-col gap-1 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="truncate font-medium text-foreground">{o.nome}</p>
                <span className="text-xs text-muted tabular-nums">cadastro em {data(o.criadoEm)}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                <Badge tom="neutral">{o.plano === "teste" ? "Teste" : "Só a rede"}</Badge>
                <Badge tom={o.emailConfirmado ? "success" : "warning"}>{o.emailConfirmado ? "E-mail confirmado" : "E-mail não confirmado"}</Badge>
                {o.plano === "teste" ? (
                  <>
                    <Badge tom={o.contas > 0 ? "success" : "neutral"}>{`${o.contas} conta(s)`}</Badge>
                    <Badge tom={o.obras > 0 ? "success" : "neutral"}>{`${o.obras} projeto(s)`}</Badge>
                    <Badge tom={o.produtos > 0 ? "success" : "neutral"}>{`${o.produtos} produto(s)`}</Badge>
                    <Badge tom={o.compromissos > 0 ? "success" : "neutral"}>{`${o.compromissos} compromisso(s)`}</Badge>
                  </>
                ) : (
                  <Badge tom={o.perfilPublicado ? "success" : "neutral"}>{o.perfilPublicado ? "Perfil publicado" : "Perfil não publicado"}</Badge>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-foreground">E-mails de ciclo de vida</h2>
          <p className="text-sm text-muted">Últimos 30 dias. Entrega e abertura dependem do aviso do provedor (webhook), que ainda não está ligado: aqui conta só o que o sistema enviou ou tentou enviar.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["pendente", "enviado", "falhou", "cancelado"].map((s) => (
            <Badge key={s} tom={s === "falhou" ? "danger" : s === "enviado" ? "success" : "neutral"}>
              {`${ROTULO_STATUS[s]}: ${painel.emails.porStatus[s] ?? 0}`}
            </Badge>
          ))}
        </div>
        {painel.emails.falhas.length > 0 && (
          <ul className="flex flex-col divide-y divide-border">
            {painel.emails.falhas.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="text-foreground">
                  {ROTULO_CAMPANHA[f.campanha] ?? f.campanha} · {f.destino}
                </span>
                <span className="text-muted">
                  {f.tentativas} tentativa(s) · {f.erro ?? "sem detalhe"} · <span className="tabular-nums">{data(f.criadoEm)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
