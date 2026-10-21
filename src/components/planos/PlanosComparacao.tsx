"use client";

import { useEffect, useState, useTransition } from "react";
import type { PlanoComercialPublico } from "@/types";
import { diferencaAnualEntrePlanos, economiaAnual, formatarPreco, valorDaParcela } from "@/lib/planos/comercial";
import { FUNCIONALIDADES, PROBLEMAS } from "@/lib/planos/vitrine";
import { MARCA } from "@/lib/marca";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { registrarInteracaoOferta } from "@/services/data/server/planosComerciaisActions";
import { iniciarAssinaturaMensal, iniciarPagamentoAnual } from "@/services/data/server/assinaturaComercialActions";

const contato = (assunto: string) => `mailto:${MARCA.emailContato}?subject=${encodeURIComponent(assunto)}`;

/** CTA do plano: checkout real do Mercado Pago quando configurado, ou o contato com a equipe (único caminho sem preço ou sem provedor). */
function ContratarPlano({ plano, pagamentoDisponivel }: { plano: PlanoComercialPublico; pagamentoDisponivel: boolean }) {
  const [erro, setErro] = useState<string | null>(null);
  const [acaoPendente, setAcaoPendente] = useState<"mensal" | "anual" | null>(null);
  const [pendente, iniciar] = useTransition();

  function registrarClique() {
    void registrarInteracaoOferta({ contexto: "pagina_planos", tipo: "clicada", planoChave: plano.chave }).catch(() => undefined);
  }

  function contratar(ciclo: "mensal" | "anual") {
    setErro(null);
    setAcaoPendente(ciclo);
    registrarClique();
    iniciar(async () => {
      const resultado = ciclo === "mensal" ? await iniciarAssinaturaMensal(plano.chave) : await iniciarPagamentoAnual(plano.chave);
      if (resultado.ok) {
        window.location.href = resultado.dados.url;
      } else {
        setErro(resultado.mensagem);
      }
    });
  }

  const semPreco = plano.precoMensalCentavos === null && plano.precoAnualCentavos === null;
  if (!pagamentoDisponivel || semPreco) {
    return (
      <a
        href={contato(`Quero contratar o plano ${plano.nome}`)}
        onClick={registrarClique}
        className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground transition-colors hover:opacity-90"
      >
        Quero este plano
      </a>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {plano.precoMensalCentavos !== null && (
        <Button onClick={() => contratar("mensal")} disabled={pendente}>
          {pendente && acaoPendente === "mensal" ? "Abrindo pagamento…" : "Assinar mensal"}
        </Button>
      )}
      {plano.precoAnualCentavos !== null && (
        <Button variante="outline" onClick={() => contratar("anual")} disabled={pendente}>
          {pendente && acaoPendente === "anual" ? "Abrindo pagamento…" : plano.parcelasSemJuros ? `Pagar o anual em ${plano.parcelasSemJuros}x sem juros` : "Pagar o anual"}
        </Button>
      )}
      {erro && (
        <p role="alert" className="text-xs text-danger">
          {erro}
        </p>
      )}
      <a href={contato(`Quero contratar o plano ${plano.nome}`)} onClick={registrarClique} className="text-center text-xs text-muted underline underline-offset-2 hover:text-foreground">
        Prefiro combinar com a equipe
      </a>
    </div>
  );
}

function textoVagas(p: PlanoComercialPublico): { texto: string; esgotado: boolean } | null {
  if (p.vagasTotal === null || p.vagasRestantes === null) return null;
  if (p.vagasRestantes === 0) return { texto: `Vagas esgotadas: eram só para os ${p.vagasTotal} primeiros clientes.`, esgotado: true };
  const restam = p.vagasRestantes === 1 ? "Resta 1 vaga" : `Restam ${p.vagasRestantes} vagas`;
  return { texto: `Somente para os ${p.vagasTotal} primeiros clientes. ${restam}.`, esgotado: false };
}

function Precos({ plano }: { plano: PlanoComercialPublico }) {
  const mensal = formatarPreco(plano.precoMensalCentavos);
  const anual = formatarPreco(plano.precoAnualCentavos);
  const parcela = formatarPreco(valorDaParcela(plano.precoAnualCentavos, plano.parcelasSemJuros));
  const economia = economiaAnual(plano);
  if (!mensal && !anual) return <p className="text-lg font-semibold text-foreground">Sob consulta</p>;
  return (
    <div className="flex flex-col gap-1 tabular-nums">
      {mensal && (
        <p className="text-foreground">
          <span className="text-3xl font-semibold">{mensal}</span> <span className="text-sm text-muted">por mês</span>
        </p>
      )}
      {anual && (
        <p className="text-sm text-foreground">
          {parcela && plano.parcelasSemJuros ? (
            <>
              ou <span className="font-semibold">{plano.parcelasSemJuros}x de {parcela}</span> sem juros <span className="text-muted">(total de {anual} por ano)</span>
            </>
          ) : (
            <>
              ou <span className="font-semibold">{anual}</span> por ano
            </>
          )}
          {economia && <span className="ml-1 text-success">· {economia.percentual}% menos que pagar 12 meses</span>}
        </p>
      )}
    </div>
  );
}

/** Página de planos: o problema que o sistema resolve primeiro, depois os planos publicados com os valores cadastrados e o checkout (quando o Mercado Pago está configurado). */
export function PlanosComparacao({ planos, pagamentoDisponivel }: { planos: PlanoComercialPublico[]; pagamentoDisponivel: boolean }) {
  useEffect(() => {
    registrarInteracaoOferta({ contexto: "pagina_planos", tipo: "visualizada" }).catch(() => undefined);
  }, []);

  const menorMensal = Math.min(...planos.map((p) => p.precoMensalCentavos ?? Number.POSITIVE_INFINITY));
  const maiorMensal = Math.max(...planos.map((p) => p.precoMensalCentavos ?? 0));
  const beneficios = [...new Set(planos.flatMap((p) => p.beneficios))];
  const diferem = planos.some((p) => beneficios.some((b) => !p.beneficios.includes(b)));

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="problemas" className="flex flex-col gap-4">
        <div className="max-w-2xl">
          <h2 id="problemas" className="text-xl font-semibold text-foreground">
            O que o Elo Gestão resolve na sua empresa
          </h2>
          <p className="text-sm text-muted">Os problemas do dia a dia de quem toca obras e serviços, e o que o sistema faz a respeito de cada um.</p>
        </div>
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {PROBLEMAS.map((p) => (
            <li key={p.id} className="grid gap-1 px-4 py-3 md:grid-cols-[2fr_3fr] md:gap-6">
              <p className="font-medium text-foreground">{p.problema}</p>
              <div>
                <p className="text-sm text-foreground">{p.solucao}</p>
                <p className="mt-0.5 text-xs text-muted">{p.recurso}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="planos" className="flex flex-col gap-4">
        <h2 id="planos" className="text-xl font-semibold text-foreground">
          Planos
        </h2>
        {planos.length === 0 ? (
          <Card className="flex max-w-xl flex-col gap-2">
            <p className="font-medium text-foreground">Os planos e valores ainda não foram publicados.</p>
            <p className="text-sm text-muted">Para continuar usando depois do teste, fale com a equipe e combinamos o melhor caminho.</p>
            <a href={contato("Quero continuar usando o Elo Negócios")} className="text-sm font-medium text-primary underline underline-offset-2">
              Falar com a equipe
            </a>
          </Card>
        ) : (
          <div className={cn("grid gap-4", planos.length > 1 && "md:grid-cols-2", planos.length > 2 && "lg:grid-cols-3")}>
            {planos.map((p) => {
              const vagas = textoVagas(p);
              const esgotado = vagas?.esgotado ?? false;
              const economiaFrenteAoOutro =
                p.precoMensalCentavos !== null && p.precoMensalCentavos === menorMensal && maiorMensal > menorMensal ? diferencaAnualEntrePlanos(menorMensal, maiorMensal) : null;
              return (
                <Card key={p.chave} className={cn("flex flex-col gap-3", p.destaque && !esgotado && "border-primary", esgotado && "opacity-80")}>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-semibold text-foreground">{p.nome}</h3>
                    {p.destaque && !esgotado && <Badge tom="info">Recomendado</Badge>}
                  </div>
                  {vagas && (
                    <p role="status" className={cn("rounded-md border px-3 py-1.5 text-sm font-medium", vagas.esgotado ? "border-border text-muted" : "border-warning/50 bg-warning-bg text-warning")}>
                      {vagas.texto}
                    </p>
                  )}
                  <p className="text-sm text-muted">{p.descricao}</p>
                  <Precos plano={p} />
                  {economiaFrenteAoOutro !== null && (
                    <p className="text-sm text-foreground tabular-nums">
                      São {formatarPreco(economiaFrenteAoOutro)} a menos por ano que o plano de {formatarPreco(maiorMensal)} por mês, com as mesmas funcionalidades.
                    </p>
                  )}
                  {p.condicao && <p className="text-sm text-muted">{p.condicao}</p>}
                  {p.beneficios.length > 0 && (
                    <ul className="flex flex-1 flex-col gap-1.5 text-sm">
                      {p.beneficios.map((b) => (
                        <li key={b} className="flex gap-2 text-foreground">
                          <span aria-hidden className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
                  {esgotado ? <p className="text-sm text-muted">Sem vagas no momento.</p> : <ContratarPlano plano={p} pagamentoDisponivel={pagamentoDisponivel} />}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="funcionalidades" className="flex flex-col gap-4">
        <div className="max-w-2xl">
          <h2 id="funcionalidades" className="text-xl font-semibold text-foreground">
            Tudo o que o Elo Gestão inclui
          </h2>
          <p className="text-sm text-muted">As funcionalidades abaixo valem para todos os planos pagos: o que muda de um plano para outro é o preço e a condição.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {FUNCIONALIDADES.map((g) => (
            <Card key={g.titulo} className="flex flex-col gap-2">
              <h3 className="font-semibold text-foreground">{g.titulo}</h3>
              <ul className="flex flex-col gap-1.5 text-sm">
                {g.itens.map((i) => (
                  <li key={i} className="flex gap-2 text-foreground">
                    <span aria-hidden className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                    {i}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      {planos.length > 1 && diferem && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">Comparação do que cada plano inclui</caption>
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="px-4 py-2 font-medium text-muted">
                  Inclui
                </th>
                {planos.map((p) => (
                  <th key={p.chave} scope="col" className="px-4 py-2 text-center font-semibold text-foreground">
                    {p.nome}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {beneficios.map((b) => (
                <tr key={b} className="border-b border-border last:border-b-0">
                  <th scope="row" className="px-4 py-2 text-left font-normal text-foreground">
                    {b}
                  </th>
                  {planos.map((p) => (
                    <td key={p.chave} className="px-4 py-2 text-center">
                      {p.beneficios.includes(b) ? <span aria-label="Incluído" className="text-success">✓</span> : <span aria-label="Não incluído" className="text-muted">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted">
        {pagamentoDisponivel
          ? "Valores definidos pela administração. O pagamento é processado pelo Mercado Pago."
          : "Valores definidos pela administração. A contratação é combinada com a equipe: ainda não há pagamento automático no sistema."}
      </p>
    </div>
  );
}
