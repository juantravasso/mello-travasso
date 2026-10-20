"use client";

import { useEffect, useState } from "react";
import { obterPreferenciaComunicacao, salvarPreferenciaComunicacao } from "@/services/data/server/comunicacaoActions";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

/** Dicas e novidades por e-mail. Os avisos sobre a conta (fim do teste, acesso) não dependem desta escolha. */
export function PreferenciasComunicacao() {
  const [ligado, setLigado] = useState<boolean | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    obterPreferenciaComunicacao()
      .then((r) => {
        if (!r.ok) throw new Error(r.mensagem);
        setLigado(r.dados.emailsPromocionais);
      })
      .catch((e) => setErro(mensagemDeErro(e)));
  }, []);

  async function alternar() {
    if (ligado === null || ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      const r = await salvarPreferenciaComunicacao(!ligado);
      if (!r.ok) throw new Error(r.mensagem);
      setLigado(r.dados.emailsPromocionais);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">Dicas e novidades por e-mail</p>
          <p className="text-sm text-muted">Sugestões de uso do sistema. Os avisos sobre a sua conta, como o fim do teste, continuam chegando.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={ligado === true}
          aria-label="Receber dicas e novidades por e-mail"
          disabled={ligado === null || ocupado}
          onClick={alternar}
          className={cn(
            "relative h-6 w-11 flex-shrink-0 rounded-full border border-border transition-colors disabled:opacity-50",
            ligado ? "bg-primary" : "bg-surface-2",
          )}
        >
          <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", ligado ? "left-[22px]" : "left-0.5")} />
        </button>
      </div>
      {erro && (
        <p role="alert" className="text-sm text-danger">
          {erro}
        </p>
      )}
    </Card>
  );
}
