"use client";

import { useCallback, useEffect, useState } from "react";
import type { PlanoComercialAdmin } from "@/types";
import { obterPlanosAdmin, salvarPlanoComercial } from "@/services/data/server/planosComerciaisActions";
import { centavosParaReais, economiaAnual, formatarPreco, reaisParaCentavos } from "@/lib/planos/comercial";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { PainelConfirmacao } from "./PainelConfirmacao";

interface Rascunho {
  chave: string;
  novo: boolean;
  nome: string;
  descricao: string;
  mensal: string;
  anual: string;
  beneficios: string;
  destaque: boolean;
  publicado: boolean;
  ordem: string;
  vagas: string;
  parcelas: string;
  condicao: string;
}

const VAZIO: Rascunho = { chave: "", novo: true, nome: "", descricao: "", mensal: "", anual: "", beneficios: "", destaque: false, publicado: false, ordem: "0", vagas: "", parcelas: "", condicao: "" };

const doPlano = (p: PlanoComercialAdmin): Rascunho => ({
  chave: p.chave,
  novo: false,
  nome: p.nome,
  descricao: p.descricao,
  mensal: centavosParaReais(p.precoMensalCentavos),
  anual: centavosParaReais(p.precoAnualCentavos),
  beneficios: p.beneficios.join("\n"),
  destaque: p.destaque,
  publicado: p.publicado,
  ordem: String(p.ordem),
  vagas: p.vagasTotal === null ? "" : String(p.vagasTotal),
  parcelas: p.parcelasSemJuros === null ? "" : String(p.parcelasSemJuros),
  condicao: p.condicao ?? "",
});

/** Catálogo comercial: o que a página de planos e as ofertas mostram. Não muda o acesso de ninguém (isso é "Planos e permissões"). */
export function PlanosComerciaisAdmin() {
  const [planos, setPlanos] = useState<PlanoComercialAdmin[] | null>(null);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    const r = await obterPlanosAdmin();
    if (!r.ok) throw new Error(r.mensagem);
    setPlanos(r.dados);
  }, []);

  useEffect(() => {
    carregar().catch((e) => setErro(mensagemDeErro(e)));
  }, [carregar]);

  function campo<K extends keyof Rascunho>(chave: K, valor: Rascunho[K]) {
    setRascunho((r) => (r ? { ...r, [chave]: valor } : r));
  }

  function montarEntrada(r: Rascunho) {
    return {
      chave: r.chave.trim(),
      nome: r.nome,
      descricao: r.descricao,
      precoMensalCentavos: reaisParaCentavos(r.mensal),
      precoAnualCentavos: reaisParaCentavos(r.anual),
      beneficios: r.beneficios.split("\n").map((l) => l.trim()).filter(Boolean),
      destaque: r.destaque,
      publicado: r.publicado,
      ordem: Number(r.ordem),
      vagasTotal: r.vagas.trim() === "" ? null : Number(r.vagas),
      parcelasSemJuros: r.parcelas.trim() === "" ? null : Number(r.parcelas),
      condicao: r.condicao.trim() === "" ? null : r.condicao.trim(),
    };
  }

  async function salvar(motivo: string, senha: string) {
    if (!rascunho) return;
    setOcupado(true);
    setErro(null);
    try {
      const r = await salvarPlanoComercial(montarEntrada(rascunho), motivo, senha);
      if (!r.ok) {
        setErro(r.mensagem);
        return;
      }
      setAviso(`Plano ${rascunho.nome} salvo${rascunho.publicado ? " e publicado" : " como rascunho"}.`);
      setRascunho(null);
      setConfirmando(false);
      await carregar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  const entrada = rascunho ? montarEntrada(rascunho) : null;
  const precoInvalido = rascunho && (Number.isNaN(entrada?.precoMensalCentavos) || Number.isNaN(entrada?.precoAnualCentavos));
  const economia = entrada && !precoInvalido ? economiaAnual({ precoMensalCentavos: entrada.precoMensalCentavos, precoAnualCentavos: entrada.precoAnualCentavos }) : null;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <p className="text-sm text-muted">
        É a vitrine da página <span className="font-medium text-foreground">Planos</span> e das ofertas. Nada aparece para os clientes até você publicar um plano, e
        o preço mostrado é exatamente o que estiver aqui. Isto não muda o acesso de ninguém nem cobra: o acesso continua em Planos e permissões, e a contratação
        é combinada com a equipe.
      </p>
      {erro && (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger-bg px-3 py-2 text-sm text-danger">
          {erro}
        </p>
      )}
      {aviso && (
        <p role="status" className="rounded-md border border-success/40 bg-success-bg px-3 py-2 text-sm text-success">
          {aviso}
        </p>
      )}

      {planos?.length === 0 && !rascunho && <Card className="text-sm text-muted">Nenhum plano cadastrado. Os clientes veem “planos ainda não publicados”.</Card>}
      {planos?.map((p) => (
        <Card key={p.chave} className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
              {p.nome}
              <Badge tom={p.publicado ? "success" : "neutral"}>{p.publicado ? "Publicado" : "Rascunho"}</Badge>
              {p.destaque && <Badge tom="info">Recomendado</Badge>}
            </p>
            <p className="text-sm text-muted tabular-nums">
              {formatarPreco(p.precoMensalCentavos) ?? "sem preço mensal"} · {formatarPreco(p.precoAnualCentavos) ?? "sem preço anual"} · {p.beneficios.length} benefícios{p.vagasTotal !== null ? ` · vagas: ${p.vagasOcupadas} de ${p.vagasTotal} ocupadas` : ""}
            </p>
          </div>
          <Button type="button" variante="outline" tamanho="sm" onClick={() => { setAviso(null); setErro(null); setConfirmando(false); setRascunho(doPlano(p)); }}>
            Editar
          </Button>
        </Card>
      ))}

      {!rascunho && (
        <div>
          <Button type="button" tamanho="sm" onClick={() => { setAviso(null); setErro(null); setRascunho(VAZIO); }}>
            Novo plano
          </Button>
        </div>
      )}

      {rascunho && (
        <Card className="flex flex-col gap-3">
          <h2 className="font-semibold text-foreground">{rascunho.novo ? "Novo plano" : `Editar ${rascunho.nome}`}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Nome" value={rascunho.nome} maxLength={60} onChange={(e) => campo("nome", e.target.value)} />
            <Input
              label="Chave (identificador, não muda)"
              value={rascunho.chave}
              maxLength={30}
              disabled={!rascunho.novo}
              onChange={(e) => campo("chave", e.target.value.toLowerCase())}
            />
          </div>
          <Input label="Descrição (uma frase)" value={rascunho.descricao} maxLength={240} onChange={(e) => campo("descricao", e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Input label="Preço mensal (R$)" inputMode="decimal" value={rascunho.mensal} placeholder="vazio = sob consulta" onChange={(e) => campo("mensal", e.target.value)} />
            <Input label="Preço anual (R$)" inputMode="decimal" value={rascunho.anual} placeholder="vazio = sem plano anual" onChange={(e) => campo("anual", e.target.value)} />
            <Input label="Ordem na página" inputMode="numeric" value={rascunho.ordem} onChange={(e) => campo("ordem", e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input label="Limite de vagas" inputMode="numeric" value={rascunho.vagas} placeholder="vazio = sem limite" onChange={(e) => campo("vagas", e.target.value)} />
            <Input label="Parcelas sem juros (anual)" inputMode="numeric" value={rascunho.parcelas} placeholder="só após o provedor confirmar" onChange={(e) => campo("parcelas", e.target.value)} />
            <Input label="Condição do preço" value={rascunho.condicao} maxLength={120} placeholder="ex.: Preço garantido por 12 meses" onChange={(e) => campo("condicao", e.target.value)} />
          </div>
          <p className="text-xs text-muted">
            O “restam N vagas” que o cliente vê é calculado: limite menos as empresas no plano Ativo com este plano comercial. Não dá para digitar o número. Só preencha as parcelas sem juros depois de confirmar que o provedor de pagamento oferece.
          </p>
          {precoInvalido && <p className="text-xs text-danger">Preço inválido. Use só números, por exemplo 49,90.</p>}
          {economia && <p className="text-xs text-muted">O anual sai {economia.percentual}% mais barato que 12 mensalidades; a página mostra essa economia.</p>}
          <Textarea label="O que inclui (um benefício por linha)" rows={5} value={rascunho.beneficios} onChange={(e) => campo("beneficios", e.target.value)} />
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={rascunho.publicado} onChange={(e) => campo("publicado", e.target.checked)} />
              Publicado (visível para os clientes)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={rascunho.destaque} onChange={(e) => campo("destaque", e.target.checked)} />
              Recomendado
            </label>
          </div>
          {confirmando ? (
            <PainelConfirmacao rotuloMotivo="Motivo da alteração" rotuloBotao="Salvar plano" ocupado={ocupado} aoConfirmar={salvar} aoCancelar={() => setConfirmando(false)} />
          ) : (
            <div className="flex gap-2">
              <Button type="button" tamanho="sm" disabled={!!precoInvalido} onClick={() => setConfirmando(true)}>
                Salvar
              </Button>
              <Button type="button" variante="ghost" tamanho="sm" onClick={() => setRascunho(null)}>
                Cancelar
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
