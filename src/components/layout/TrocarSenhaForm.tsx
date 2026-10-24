"use client";

import { useActionState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { trocarSenha } from "@/services/data/server/authActions";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { TAMANHO_MINIMO_SENHA } from "@/lib/validacao/auth";
import { Button } from "@/components/ui/Button";

interface EstadoTrocarSenha {
  erroGeral?: string;
  sucesso?: boolean;
  campos?: Record<string, string>;
}

const ESTADO_INICIAL: EstadoTrocarSenha = {};

/** `bloqueante`: tela de troca obrigatória (senha temporária); ao concluir, recarrega o layout para liberar o app. */
export function TrocarSenhaForm({ bloqueante = false }: { bloqueante?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const obrigatoria = bloqueante || searchParams.get("trocarSenha") === "1";

  async function acao(_estadoAnterior: EstadoTrocarSenha, formData: FormData): Promise<EstadoTrocarSenha> {
    const resultado = await trocarSenha({
      senhaAtual: String(formData.get("senhaAtual") ?? ""),
      senhaNova: String(formData.get("senhaNova") ?? ""),
    });

    if (resultado.ok) {
      return { sucesso: true };
    }
    return { erroGeral: resultado.mensagem, campos: resultado.campos };
  }

  const [estado, formAction, emAndamento] = useActionState(acao, ESTADO_INICIAL);

  useEffect(() => {
    if (bloqueante && estado.sucesso) router.refresh();
  }, [bloqueante, estado.sucesso, router]);

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <p className="font-medium text-foreground">Senha de acesso</p>
        {obrigatoria && !estado.sucesso && (
          <p role="status" className="mt-1 rounded-lg border border-warning bg-warning-bg px-3 py-2 text-sm text-warning">
            Troque a senha temporária antes de continuar.
          </p>
        )}
        <p className="text-sm text-muted">Ao trocar a senha, as outras sessões deste usuário são encerradas.</p>
      </div>

      {estado.sucesso ? (
        <p role="status" className="text-sm text-success">
          Senha alterada.
        </p>
      ) : (
        <form action={formAction} className="flex flex-col gap-3" noValidate>
          <Input
            id="senhaAtual"
            name="senhaAtual"
            type="password"
            label="Senha atual"
            autoComplete="current-password"
            required
            erro={estado.campos?.senhaAtual}
          />
          <Input
            id="senhaNova"
            name="senhaNova"
            type="password"
            label="Nova senha"
            autoComplete="new-password"
            required
            minLength={TAMANHO_MINIMO_SENHA}
            erro={estado.campos?.senhaNova}
          />
          {estado.erroGeral && !estado.campos && (
            <p role="alert" aria-live="polite" className="text-sm text-danger">
              {estado.erroGeral}
            </p>
          )}
          <Button type="submit" variante="secondary" aria-busy={emAndamento} disabled={emAndamento}>
            {emAndamento ? "Salvando…" : "Trocar senha"}
          </Button>
        </form>
      )}
    </Card>
  );
}
