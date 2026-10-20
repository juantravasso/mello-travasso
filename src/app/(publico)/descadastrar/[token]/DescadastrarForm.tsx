"use client";

import { useState } from "react";
import Link from "next/link";
import { descadastrarEmails } from "@/services/data/server/comunicacaoActions";
import { Button } from "@/components/ui/Button";

type Situacao = { tipo: "pronto" } | { tipo: "enviando" } | { tipo: "feito" } | { tipo: "erro"; mensagem: string };

// O descadastro só acontece no clique: abrir o link (inclusive por leitor de e-mail ou antivírus) não muda nada.
export function DescadastrarForm({ token }: { token: string }) {
  const [situacao, setSituacao] = useState<Situacao>({ tipo: "pronto" });

  async function confirmar() {
    setSituacao({ tipo: "enviando" });
    try {
      const resultado = await descadastrarEmails(token);
      setSituacao(resultado.ok ? { tipo: "feito" } : { tipo: "erro", mensagem: resultado.mensagem });
    } catch {
      setSituacao({ tipo: "erro", mensagem: "Não foi possível agora. Tente de novo." });
    }
  }

  if (situacao.tipo === "feito") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-foreground">Pronto</h1>
        <p className="text-sm text-muted">
          Você não vai mais receber dicas e novidades por e-mail. Avisos sobre a sua conta, como o fim do teste, continuam chegando, porque você precisa deles.
          Dá para voltar a receber dicas em Configurações.
        </p>
        <Link href="/login" className="w-fit font-medium text-primary underline underline-offset-4">
          Entrar
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-[-0.01em] text-foreground">Parar de receber dicas por e-mail?</h1>
      <p className="text-sm text-muted">
        Você deixa de receber as dicas de uso e novidades. Os avisos sobre a sua conta (confirmação de e-mail, fim do teste, mudanças de acesso) continuam.
      </p>
      {situacao.tipo === "erro" && (
        <p role="alert" className="rounded-lg border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
          {situacao.mensagem}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="button" onClick={confirmar} disabled={situacao.tipo === "enviando"} aria-busy={situacao.tipo === "enviando"}>
          {situacao.tipo === "enviando" ? "Salvando…" : "Parar de receber dicas"}
        </Button>
        <Link href="/" className="text-sm text-muted underline underline-offset-4">
          Manter como está
        </Link>
      </div>
    </div>
  );
}
