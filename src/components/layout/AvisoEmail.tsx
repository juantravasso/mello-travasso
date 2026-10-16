"use client";

import { useState } from "react";
import { redeRepositorio } from "@/services/data";

type Situacao = { tipo: "ocioso" } | { tipo: "enviando" } | { tipo: "enviado" } | { tipo: "erro"; mensagem: string };

/**
 * Faixa fixa no topo da área logada enquanto o e-mail não foi confirmado.
 * Gestão continua liberada; o que depende de e-mail confirmado (publicar,
 * avaliar, denunciar…) mostra o motivo no próprio fluxo.
 */
export function AvisoEmail({ email }: { email: string }) {
  const [situacao, setSituacao] = useState<Situacao>({ tipo: "ocioso" });

  async function reenviar() {
    setSituacao({ tipo: "enviando" });
    try {
      const resultado = await redeRepositorio.reenviarConfirmacaoEmail();
      setSituacao(resultado.ok ? { tipo: "enviado" } : { tipo: "erro", mensagem: resultado.mensagem });
    } catch {
      setSituacao({ tipo: "erro", mensagem: "Não foi possível enviar agora. Tente de novo." });
    }
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-warning bg-warning-bg px-4 py-2 text-sm text-warning sm:px-8"
    >
      <span>
        Confirme seu e-mail para publicar na rede e avaliar. O link vai para{" "}
        <span className="font-medium break-all">{email}</span>; se não chegou, peça outro.
      </span>
      <span className="flex items-center gap-3">
        {situacao.tipo === "enviado" && <span>Enviado. Confira a caixa de entrada e o spam.</span>}
        {situacao.tipo === "erro" && <span role="alert">{situacao.mensagem}</span>}
        <button
          type="button"
          onClick={reenviar}
          disabled={situacao.tipo === "enviando"}
          className="min-h-9 font-medium underline underline-offset-2 disabled:opacity-60"
        >
          {situacao.tipo === "enviando" ? "Enviando…" : "Reenviar e-mail"}
        </button>
      </span>
    </div>
  );
}
