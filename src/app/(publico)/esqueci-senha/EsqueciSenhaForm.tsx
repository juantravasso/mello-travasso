"use client";

import { useState } from "react";
import Link from "next/link";
import { solicitarRedefinicaoDeSenha } from "@/services/data/server/senhaActions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Situacao = { tipo: "ocioso" } | { tipo: "enviando" } | { tipo: "enviado" } | { tipo: "erro"; mensagem: string };

export function EsqueciSenhaForm() {
  const [email, setEmail] = useState("");
  const [situacao, setSituacao] = useState<Situacao>({ tipo: "ocioso" });

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setSituacao({ tipo: "enviando" });
    try {
      const resultado = await solicitarRedefinicaoDeSenha({ email });
      setSituacao(resultado.ok ? { tipo: "enviado" } : { tipo: "erro", mensagem: resultado.mensagem });
    } catch {
      setSituacao({ tipo: "erro", mensagem: "Não foi possível enviar agora. Tente de novo." });
    }
  }

  if (situacao.tipo === "enviado") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground">Confira seu e-mail</h1>
        <p className="text-sm text-muted">
          Se houver uma conta com esse e-mail, enviamos um link para escolher uma nova senha. Ele vale por 1 hora. Se não chegar em alguns
          minutos, olhe o spam.
        </p>
        <Link href="/login" className="w-fit text-sm font-medium text-primary underline underline-offset-4">
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground">Esqueci minha senha</h1>
        <p className="text-sm text-muted">Informe o e-mail da conta. Enviamos um link para escolher uma nova senha.</p>
      </div>
      <Input id="email" name="email" type="email" label="E-mail" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      {situacao.tipo === "erro" && (
        <p role="alert" className="rounded-lg border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
          {situacao.mensagem}
        </p>
      )}
      <Button
        type="submit"
        className="w-full shadow-none"
        disabled={situacao.tipo === "enviando" || email.trim().length === 0}
        aria-busy={situacao.tipo === "enviando"}
      >
        {situacao.tipo === "enviando" ? "Enviando…" : "Enviar link"}
      </Button>
      <Link href="/login" className="w-fit text-sm text-muted underline underline-offset-4">
        Voltar para o login
      </Link>
    </form>
  );
}
