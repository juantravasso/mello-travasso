"use client";

import { useState } from "react";
import Link from "next/link";
import { redefinirSenha } from "@/services/data/server/senhaActions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TAMANHO_MINIMO_SENHA } from "@/lib/validacao/auth";

type Situacao = { tipo: "ocioso" } | { tipo: "enviando" } | { tipo: "pronto" } | { tipo: "erro"; mensagem: string };

export function RedefinirSenhaForm({ token }: { token: string }) {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [situacao, setSituacao] = useState<Situacao>({ tipo: "ocioso" });

  const diferente = confirmacao.length > 0 && senha !== confirmacao;

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (senha !== confirmacao) return;
    setSituacao({ tipo: "enviando" });
    try {
      const resultado = await redefinirSenha({ token, senhaNova: senha });
      setSituacao(resultado.ok ? { tipo: "pronto" } : { tipo: "erro", mensagem: resultado.mensagem });
    } catch {
      setSituacao({ tipo: "erro", mensagem: "Não foi possível salvar agora. Tente de novo." });
    }
  }

  if (situacao.tipo === "pronto") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground">Senha alterada</h1>
        <p className="text-sm text-muted">Pronto. Por segurança, encerramos as sessões abertas. Entre com a nova senha.</p>
        <Link href="/login" className="w-fit font-medium text-primary underline underline-offset-4">
          Ir para o login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground">Escolha uma nova senha</h1>
        <p className="text-sm text-muted">Use pelo menos {TAMANHO_MINIMO_SENHA} caracteres.</p>
      </div>
      <Input
        id="senhaNova"
        name="senhaNova"
        type="password"
        label="Nova senha"
        autoComplete="new-password"
        required
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        maxLength={128}
      />
      <Input
        id="confirmacao"
        name="confirmacao"
        type="password"
        label="Repita a nova senha"
        autoComplete="new-password"
        required
        value={confirmacao}
        onChange={(e) => setConfirmacao(e.target.value)}
        maxLength={128}
        erro={diferente ? "As senhas não são iguais." : undefined}
      />
      {situacao.tipo === "erro" && (
        <p role="alert" className="rounded-lg border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
          {situacao.mensagem}{" "}
          <Link href="/esqueci-senha" className="font-medium underline underline-offset-2">
            Pedir novo link
          </Link>
        </p>
      )}
      <Button
        type="submit"
        className="w-full shadow-none"
        disabled={!token || situacao.tipo === "enviando" || senha.length < TAMANHO_MINIMO_SENHA || senha !== confirmacao}
        aria-busy={situacao.tipo === "enviando"}
      >
        {situacao.tipo === "enviando" ? "Salvando…" : "Salvar nova senha"}
      </Button>
    </form>
  );
}
