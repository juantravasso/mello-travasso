"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { entrar } from "@/services/data/server/authActions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface EstadoLogin {
  erroGeral?: string;
  campos?: Record<string, string>;
}

const ESTADO_INICIAL: EstadoLogin = {};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mostrarSenha, setMostrarSenha] = useState(false);

  async function acao(_estadoAnterior: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
    const resultado = await entrar({
      email: String(formData.get("email") ?? ""),
      senha: String(formData.get("senha") ?? ""),
    });

    if (resultado.ok) {
      // Troca de senha obrigatória sempre vence o `next`: sem isso, quem
      // controla a URL de retorno (ex.: um link salvo) pula a tela de troca
      // da senha temporária, que RF-17 exige no primeiro login.
      const next = searchParams.get("next");
      const destino =
        !resultado.dados.trocaObrigatoria && next && /^\/(?![\/\\])/.test(next) ? next : resultado.dados.redirecionarPara;
      router.push(destino);
      router.refresh();
      return ESTADO_INICIAL;
    }

    return { erroGeral: resultado.mensagem, campos: resultado.campos };
  }

  const [estado, formAction, emAndamento] = useActionState(acao, ESTADO_INICIAL);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <Input
        id="email"
        name="email"
        type="email"
        label="E-mail"
        autoComplete="email"
        required
        erro={estado.campos?.email}
      />

      <div className="flex flex-col gap-1">
        <label className="flex min-w-0 flex-col gap-1 text-sm" htmlFor="senha">
          <span className="font-medium text-foreground">Senha</span>
          <div className="relative">
            <input
              id="senha"
              name="senha"
              type={mostrarSenha ? "text" : "password"}
              autoComplete="current-password"
              required
              aria-describedby={estado.campos?.senha ? "senha-erro" : undefined}
              className="h-11 w-full min-w-0 rounded-lg border border-border bg-surface px-3 pr-16 text-base text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary"
            />
            <button
              type="button"
              aria-pressed={mostrarSenha}
              onClick={() => setMostrarSenha((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-xs font-medium text-muted hover:text-foreground"
            >
              {mostrarSenha ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </label>
        {estado.campos?.senha && (
          <span id="senha-erro" className="text-xs text-danger">
            {estado.campos.senha}
          </span>
        )}
        <Link href="/esqueci-senha" className="w-fit py-1 text-xs font-medium text-muted underline underline-offset-4 hover:text-foreground">
          Esqueci minha senha
        </Link>
      </div>

      {estado.erroGeral && (
        <p role="alert" aria-live="polite" className="rounded-lg border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
          {estado.erroGeral}
        </p>
      )}

      <Button type="submit" variante="primary" className="w-full shadow-none" aria-busy={emAndamento} disabled={emAndamento}>
        {emAndamento ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
