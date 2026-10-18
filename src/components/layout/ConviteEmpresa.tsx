"use client";

import { useEffect, useRef, useState } from "react";
import type { ResumoConvite } from "@/types";
import { conviteRepositorio as repo } from "@/services/data";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/** Só o dono vê isto (a página nem renderiza para membros; a ação também recusa no servidor). */
export function ConviteEmpresa() {
  const [convite, setConvite] = useState<ResumoConvite | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    repo
      .obter()
      .then((resultado) => {
        if (!resultado.ok) throw new Error(resultado.mensagem);
        setConvite(resultado.dados);
      })
      .catch((e) => setErro(mensagemDeErro(e)));
  }, []);

  async function copiar() {
    if (!convite) return;
    try {
      await navigator.clipboard.writeText(convite.link);
    } catch {
      // Sem permissão para a área de transferência (ou contexto sem HTTPS): seleciona o texto para copiar à mão.
      campo.current?.select();
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  const mensagemWhatsApp = convite
    ? `Conheça o Elo Negócios: gestão de obras e contas, e uma rede de profissionais. Crie sua conta por aqui: ${convite.link}`
    : "";

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <p className="font-medium text-foreground">Convide outras empresas</p>
        <p className="text-sm text-muted">
          Quem criar a conta por este link abre a própria empresa, separada da sua. Você só vê quantas pessoas se cadastraram; nada dos dados delas.
        </p>
      </div>

      {erro && (
        <p role="alert" className="text-sm text-danger">
          {erro}
        </p>
      )}

      {!convite && !erro && <p className="text-sm text-muted">Gerando o seu link…</p>}

      {convite && (
        <>
          <input
            ref={campo}
            readOnly
            value={convite.link}
            aria-label="Link de convite da sua empresa"
            onFocus={(e) => e.currentTarget.select()}
            className="h-11 w-full min-w-0 rounded-lg border border-border bg-surface px-3 font-mono text-sm text-foreground outline-none focus:border-primary"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" tamanho="sm" onClick={copiar}>
              {copiado ? "Link copiado" : "Copiar link"}
            </Button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(mensagemWhatsApp)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
            >
              Enviar pelo WhatsApp
            </a>
          </div>
          <p className="text-sm text-muted" aria-live="polite">
            {convite.total === 0
              ? "Ninguém se cadastrou por este link ainda."
              : `${convite.total} ${convite.total === 1 ? "cadastro feito" : "cadastros feitos"} pelo seu link.`}
          </p>
        </>
      )}
    </Card>
  );
}
