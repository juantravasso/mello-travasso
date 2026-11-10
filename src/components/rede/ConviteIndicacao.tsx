"use client";

import { useEffect, useRef, useState } from "react";
import { conviteRepositorio } from "@/services/data";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/**
 * Link para indicar alguém sem preencher nada por ela: a pessoa cria a conta e o perfil pelo link e, ao publicar o
 * perfil, passa a aparecer como indicação sua. Só o dono tem o link da empresa; para os demais o cartão some.
 */
export function ConviteIndicacao() {
  const [link, setLink] = useState<string | null>(null);
  const [indisponivel, setIndisponivel] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    conviteRepositorio
      .obter()
      .then((r) => {
        if (r.ok) setLink(`${r.dados.link}&indicacao=1`);
        else setIndisponivel(true);
      })
      .catch(() => setIndisponivel(true));
  }, []);

  if (indisponivel) return null;

  async function copiar() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      campo.current?.select();
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  const mensagem = link ? `Crie o seu perfil gratuito no Elo Profissionais por aqui e apareça para quem procura o seu serviço: ${link}` : "";

  return (
    <Card className="flex flex-col gap-3 border-primary/40">
      <div>
        <h2 className="text-base font-semibold text-foreground">Indique por link</h2>
        <p className="text-sm text-muted">
          Envie este link para uma empresa ou profissional. Ele cria a própria conta e o perfil, e quando publicar o perfil ele aparece aqui como indicação sua. Você não precisa preencher nada por ele.
        </p>
      </div>
      {!link ? (
        <p className="text-sm text-muted">Gerando o seu link…</p>
      ) : (
        <>
          <input
            ref={campo}
            readOnly
            value={link}
            aria-label="Link de indicação"
            onFocus={(e) => e.currentTarget.select()}
            className="h-11 w-full min-w-0 rounded-lg border border-border bg-surface px-3 font-mono text-sm text-foreground outline-none focus:border-primary"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" tamanho="sm" onClick={() => void copiar()}>
              {copiado ? "Link copiado" : "Copiar link"}
            </Button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
            >
              Enviar pelo WhatsApp
            </a>
          </div>
        </>
      )}
    </Card>
  );
}
