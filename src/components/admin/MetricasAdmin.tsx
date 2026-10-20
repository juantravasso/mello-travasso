"use client";

import { useEffect, useState } from "react";
import type { MetricasPlataforma } from "@/types";
import { obterMetricasPlataforma } from "@/services/data/server/metricasAdminActions";
import { AMOSTRA_MINIMA, FORMULAS, formatarTaxa, NAO_MEDIDO, PERIODOS_METRICAS, taxa, type PeriodoMetricas } from "@/lib/metricas/formulas";
import { formatarDataCompleta } from "@/lib/cicloDeVida/datas";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const ROTULO_CAMPANHA: Record<string, string> = {
  boas_vindas: "Boas-vindas",
  primeira_acao: "Dica: primeira ação",
  problema: "Dica: problema do dia a dia",
  recursos: "Recursos não usados",
  fim_do_teste: "Fim do teste",
  teste_estendido: "Teste estendido",
};

const ROTULO_CONTEXTO: Record<string, string> = {
  gestao_bloqueada: "Oferta ao abrir o Elo Gestão sem acesso",
  teste_encerrado: "Oferta após o fim do teste",
  pagina_planos: "Página de planos",
};

function Linha({ rotulo, valor, base, nota }: { rotulo: string; valor: number; base?: number; nota?: string }) {
  const t = base === undefined ? null : taxa(valor, base);
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm text-foreground">{rotulo}</p>
        {nota && <p className="text-xs text-muted">{nota}</p>}
      </div>
      <div className="flex flex-shrink-0 items-baseline gap-3 tabular-nums">
        <span className="text-base font-semibold text-foreground">{valor}</span>
        {base !== undefined && <span className="w-14 text-right text-sm text-muted">{formatarTaxa(t)}</span>}
      </div>
    </div>
  );
}

function Secao({ titulo, descricao, children }: { titulo: string; descricao?: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="font-semibold text-foreground">{titulo}</h2>
      {descricao && <p className="mb-2 text-sm text-muted">{descricao}</p>}
      <div className={descricao ? "" : "mt-2"}>{children}</div>
    </Card>
  );
}

function AvisoAmostra({ total }: { total: number }) {
  if (total >= AMOSTRA_MINIMA) return null;
  return (
    <p className="mb-2 rounded-md border border-warning/40 bg-warning-bg px-3 py-2 text-xs text-warning">
      {total === 0 ? "Ainda não há dados neste período." : `Amostra pequena (${total}): as porcentagens variam muito com poucos casos.`}
    </p>
  );
}

export function MetricasAdmin() {
  const [periodo, setPeriodo] = useState<PeriodoMetricas>(30);
  const [dados, setDados] = useState<MetricasPlataforma | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setDados(null);
    setErro(null);
    obterMetricasPlataforma(periodo)
      .then((r) => {
        if (!ativo) return;
        if (r.ok) setDados(r.dados);
        else setErro(r.mensagem);
      })
      .catch((e) => ativo && setErro(mensagemDeErro(e)));
    return () => {
      ativo = false;
    };
  }, [periodo]);

  const c = dados?.coorte;
  const t = dados?.teste;
  const donos = c ? c.tour.concluido + c.tour.pulado + c.tour.emAndamento + c.tour.naoIniciado : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Período" className="flex gap-1.5">
          {PERIODOS_METRICAS.map((p) => (
            <Button key={p} type="button" tamanho="sm" variante={p === periodo ? "primary" : "outline"} aria-pressed={p === periodo} onClick={() => setPeriodo(p)}>
              {p} dias
            </Button>
          ))}
        </div>
        {dados && (
          <p className="text-xs text-muted">
            Cadastros de {formatarDataCompleta(new Date(dados.desde))} a {formatarDataCompleta(new Date(dados.ate))}
          </p>
        )}
      </div>

      {erro && (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger-bg px-3 py-2 text-sm text-danger">
          {erro}
        </p>
      )}
      {!dados && !erro && <p className="text-sm text-muted">Calculando…</p>}

      {dados && c && t && (
        <>
          {c.truncado && (
            <p className="rounded-md border border-warning/40 bg-warning-bg px-3 py-2 text-sm text-warning">
              Há mais cadastros do que o painel lê de uma vez: os números abaixo cobrem só os mais recentes. Use um período menor.
            </p>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <Secao titulo="Cadastros e ativação" descricao="Empresas criadas no período e o que fizeram até agora.">
              <AvisoAmostra total={c.cadastros} />
              <Linha rotulo="Cadastros" valor={c.cadastros} />
              <Linha rotulo="Confirmaram o e-mail" valor={c.emailConfirmado} base={c.cadastros} />
              <Linha rotulo="Ativadas" valor={c.ativadas} base={c.cadastros} nota="Já têm projeto, conta, produto, compromisso ou perfil publicado." />
              <Linha rotulo="Vieram por indicação" valor={c.porIndicacao} base={c.cadastros} />
            </Secao>

            <Secao titulo="Tour inicial" descricao="Donos dos cadastros do período.">
              <AvisoAmostra total={donos} />
              <Linha rotulo="Concluíram" valor={c.tour.concluido} base={donos} />
              <Linha rotulo="Pularam" valor={c.tour.pulado} base={donos} />
              <Linha rotulo="Em andamento" valor={c.tour.emAndamento} base={donos} />
              <Linha rotulo="Não abriram" valor={c.tour.naoIniciado} base={donos} />
            </Secao>

            <Secao titulo="Conversão do teste" descricao="Empresas que iniciaram o teste no período.">
              <AvisoAmostra total={t.amadurecidos} />
              <Linha rotulo="Iniciaram o teste" valor={t.iniciados} />
              <Linha rotulo="Ainda em teste" valor={t.emAndamento} nota="Fora da taxa até o prazo terminar." />
              <Linha rotulo="Teste terminado" valor={t.amadurecidos} />
              <Linha rotulo="Viraram plano ativo" valor={t.convertidos} base={t.amadurecidos} nota="Plano trocado pela administração; ainda não há cobrança automática." />
              <Linha rotulo="Com extensão: viraram ativo" valor={t.comExtensao.convertidos} base={t.comExtensao.amadurecidos} nota={`${t.comExtensao.amadurecidos} empresas`} />
              <Linha rotulo="Sem extensão: viraram ativo" valor={t.semExtensao.convertidos} base={t.semExtensao.amadurecidos} nota={`${t.semExtensao.amadurecidos} empresas`} />
              <Linha rotulo="Extensões concedidas" valor={t.extensoes} nota={`${t.diasEstendidos} dias no total`} />
            </Secao>

            <Secao titulo="E-mails de ciclo de vida" descricao="Fila criada no período, por campanha.">
              {dados.emails.campanhas.length === 0 ? (
                <p className="text-sm text-muted">Nenhum e-mail na fila neste período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted">
                        <th className="py-1 pr-3 font-medium">Campanha</th>
                        <th className="px-2 py-1 text-right font-medium">Enviados</th>
                        <th className="px-2 py-1 text-right font-medium">Falhas</th>
                        <th className="px-2 py-1 text-right font-medium">Cancelados</th>
                        <th className="py-1 pl-2 text-right font-medium">Na fila</th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {dados.emails.campanhas.map((e) => (
                        <tr key={e.campanha} className="border-t border-border">
                          <td className="py-1.5 pr-3 text-foreground">{ROTULO_CAMPANHA[e.campanha] ?? e.campanha}</td>
                          <td className="px-2 py-1.5 text-right">{e.enviados}</td>
                          <td className={cn("px-2 py-1.5 text-right", e.falhas > 0 && "font-medium text-danger")}>{e.falhas}</td>
                          <td className="px-2 py-1.5 text-right">{e.cancelados}</td>
                          <td className="py-1.5 pl-2 text-right">{e.naFila}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-2 border-t border-border pt-1">
                <Linha rotulo="Saíram dos e-mails promocionais" valor={dados.emails.descadastros} />
              </div>
            </Secao>
          </div>

          <Secao titulo="Ofertas e página de planos" descricao="Uma vez por pessoa, plano e dia. Só aparecem se houver plano publicado.">
            {dados.ofertas.porContexto.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma oferta vista neste período.</p>
            ) : (
              dados.ofertas.porContexto.map((o) => (
                <Linha key={o.contexto} rotulo={ROTULO_CONTEXTO[o.contexto] ?? o.contexto} valor={o.cliques} base={o.vistas} nota={`${o.vistas} visualizações, ${o.cliques} cliques`} />
              ))
            )}
          </Secao>

          <Secao titulo="O que este painel ainda não mede">
            <ul className="flex flex-col gap-1.5 text-sm">
              {NAO_MEDIDO.map((n) => (
                <li key={n.nome}>
                  <span className="font-medium text-foreground">{n.nome}.</span> <span className="text-muted">{n.motivo}</span>
                </li>
              ))}
            </ul>
            {dados.eventosDesde && (
              <p className="mt-3 text-xs text-muted">Eventos de produto registrados desde {formatarDataCompleta(new Date(dados.eventosDesde))}. Antes disso o teste iniciado não entra na conversão.</p>
            )}
          </Secao>

          <details className="rounded-xl border border-border bg-card p-4">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">Como cada número é calculado</summary>
            <dl className="mt-3 flex flex-col gap-3">
              {FORMULAS.map((f) => (
                <div key={f.id}>
                  <dt className="text-sm font-medium text-foreground">{f.nome}</dt>
                  <dd className="text-sm text-muted">{f.formula}</dd>
                  <dd className="text-xs text-muted">Fonte: {f.fonte}</dd>
                </div>
              ))}
            </dl>
          </details>
        </>
      )}
    </div>
  );
}
