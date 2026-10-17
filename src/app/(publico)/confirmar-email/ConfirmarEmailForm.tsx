"use client";

import { useState } from "react";
import Link from "next/link";
import { redeRepositorio } from "@/services/data";
import { Button } from "@/components/ui/Button";

type Situacao = { tipo: "pronto" } | { tipo: "enviando" } | { tipo: "confirmado" } | { tipo: "erro"; mensagem: string };

// A confirmação só acontece no clique: abrir o link (inclusive por leitor de
// e-mail ou antivírus) não gasta o token.
export function ConfirmarEmailForm({ token }: { token: string }) {
  const [situacao, setSituacao] = useState<Situacao>({ tipo: "pronto" });

  async function confirmar() {
    setSituacao({ tipo: "enviando" });
    try {
      const resultado = await redeRepositorio.confirmarEmail(token);
      setSituacao(resultado.ok ? { tipo: "confirmado" } : { tipo: "erro", mensagem: resultado.mensagem });
    } catch {
      setSituacao({ tipo: "erro", mensagem: "Não foi possível confirmar agora. Tente de novo." });
    }
  }

  if (situacao.tipo === "confirmado") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-foreground">E-mail confirmado</h1>
        <p className="text-sm text-muted">Pronto. Você já pode publicar seu perfil e interagir no Elo Profissionais.</p>
        <Link href="/minha-rede/perfil" className="w-fit font-medium text-primary underline underline-offset-4">
          Ir para o meu perfil
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-[-0.01em] text-foreground">Confirmar e-mail</h1>
      <p className="text-sm text-muted">Confirme que este endereço de e-mail é seu para liberar a publicação na rede.</p>
      {situacao.tipo === "erro" && (
        <p role="alert" className="rounded-lg border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
          {situacao.mensagem}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="button" onClick={confirmar} disabled={!token || situacao.tipo === "enviando"} aria-busy={situacao.tipo === "enviando"}>
          {situacao.tipo === "enviando" ? "Confirmando…" : "Confirmar e-mail"}
        </Button>
        <Link href="/login" className="text-sm text-muted underline underline-offset-4">
          Entrar
        </Link>
      </div>
    </div>
  );
}
