"use client";

import { useEffect, useState } from "react";
import type { FormaPagamentoConfigurada } from "@/lib/formaPagamento";
import { listarFormasPagamentoConfiguradas, salvarConfiguracaoFormaPagamento } from "@/services/data/server/formaPagamentoActions";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Interruptor } from "@/components/notificacoes/Interruptor";

/**
 * Como cada forma de pagamento se comporta nas contas a pagar e a receber (só o dono mexe): baixa automática, para o que se
 * paga na hora (dinheiro, PIX), e dia fixo de vencimento, para o que vence depois (fatura do cartão).
 */
export function FormasPagamentoConfig() {
  const [formas, setFormas] = useState<FormaPagamentoConfigurada[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [dias, setDias] = useState<Record<string, string>>({});

  useEffect(() => {
    listarFormasPagamentoConfiguradas()
      .then((r) => {
        if (!r.ok) throw new Error(r.mensagem);
        setFormas(r.dados);
        setDias(Object.fromEntries(r.dados.map((f) => [f.chave, f.diaVencimento ? String(f.diaVencimento) : ""])));
      })
      .catch((e) => setErro(mensagemDeErro(e)));
  }, []);

  async function salvar(forma: FormaPagamentoConfigurada, mudanca: { baixaAutomatica?: boolean; diaVencimento?: number | null }) {
    const proxima = { ...forma, ...mudanca };
    setSalvando(forma.chave);
    setErro(null);
    try {
      const r = await salvarConfiguracaoFormaPagamento({ chave: forma.chave, baixaAutomatica: proxima.baixaAutomatica, diaVencimento: proxima.diaVencimento });
      if (!r.ok) throw new Error(r.mensagem);
      setFormas((atual) => atual?.map((f) => (f.chave === forma.chave ? proxima : f)) ?? atual);
    } catch (e) {
      setErro(mensagemDeErro(e));
      setDias((d) => ({ ...d, [forma.chave]: forma.diaVencimento ? String(forma.diaVencimento) : "" }));
    } finally {
      setSalvando(null);
    }
  }

  function confirmarDia(forma: FormaPagamentoConfigurada) {
    const texto = (dias[forma.chave] ?? "").trim();
    const numero = texto === "" ? null : Number(texto);
    if (numero !== null && (!Number.isInteger(numero) || numero < 1 || numero > 31)) {
      setErro("O dia do vencimento vai de 1 a 31.");
      setDias((d) => ({ ...d, [forma.chave]: forma.diaVencimento ? String(forma.diaVencimento) : "" }));
      return;
    }
    if (numero === forma.diaVencimento) return;
    void salvar(forma, { diaVencimento: numero });
  }

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <p className="font-medium text-foreground">Formas de pagamento</p>
        <p className="text-sm text-muted">
          <strong>Baixa automática:</strong> a conta já nasce paga quando o cadastro está completo (categoria e forma escolhidas). Use para dinheiro e PIX; deixe desligada
          para boleto e cartão de crédito, que só são pagos no vencimento. <strong>Dia do vencimento:</strong> a conta entra para pagar neste dia do mês (por exemplo, o
          vencimento da fatura do cartão).
        </p>
      </div>
      {!formas && !erro && <div className="h-24 animate-pulse rounded-lg bg-surface-2" aria-busy="true" />}
      {formas && (
        <ul className="flex flex-col divide-y divide-border">
          {formas.map((f) => (
            <li key={f.chave} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
              <div className="min-w-0 sm:flex-1">
                <Interruptor
                  rotulo={f.rotulo}
                  apoio={f.baixaAutomatica ? "Baixa automática ligada" : "Fica em aberto até a baixa"}
                  ligado={f.baixaAutomatica}
                  desabilitado={salvando === f.chave}
                  aoAlternar={() => void salvar(f, { baixaAutomatica: !f.baixaAutomatica })}
                />
              </div>
              {!f.baixaAutomatica && (
                <div className="w-full sm:w-44">
                  <Input
                    label="Dia do vencimento"
                    inputMode="numeric"
                    placeholder="Ex.: 10"
                    maxLength={2}
                    value={dias[f.chave] ?? ""}
                    disabled={salvando === f.chave}
                    onChange={(e) => setDias((d) => ({ ...d, [f.chave]: e.target.value.replace(/\D/g, "") }))}
                    onBlur={() => confirmarDia(f)}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {erro && (
        <p role="alert" className="text-sm text-danger">
          {erro}
        </p>
      )}
    </Card>
  );
}
