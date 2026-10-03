"use client";

import { useCallback, useEffect, useState } from "react";
import type { MinhaDenuncia } from "@/types";
import { redeRepositorio } from "@/services/data";
import { ROTULOS_STATUS_DENUNCIA, rotuloMotivoDenuncia } from "@/lib/rede/aspectos";
import { formatarDataBr } from "@/lib/rede/texto";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";

function tomDoStatus(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "resolvida") return "success";
  if (status === "rejeitada") return "neutral";
  if (status === "aguardando_informacoes") return "warning";
  return "info";
}

function Complemento({ denuncia, aoEnviar }: { denuncia: MinhaDenuncia; aoEnviar: () => Promise<void> }) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const r = await redeRepositorio.complementarDenuncia(denuncia.id, texto);
      if (!r.ok) {
        setErro(r.mensagem);
        return;
      }
      await aoEnviar();
    } catch {
      setErro("Não foi possível enviar agora. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-2">
      <Textarea
        id={`complemento-${denuncia.id}`}
        label="Sua resposta à moderação"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        maxLength={1000}
        rows={4}
      />
      {erro && (
        <p role="alert" className="text-xs text-danger">
          {erro}
        </p>
      )}
      <div>
        <Button type="submit" tamanho="sm" disabled={enviando || texto.trim().length < 5} aria-busy={enviando}>
          {enviando ? "Enviando…" : "Enviar informação"}
        </Button>
      </div>
    </form>
  );
}

export function DenunciasPainel() {
  const [itens, setItens] = useState<MinhaDenuncia[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setItens(await redeRepositorio.listarMinhasDenuncias());
  }, []);

  useEffect(() => {
    carregar().catch(() => setErro("Não foi possível carregar agora. Tente de novo."));
  }, [carregar]);

  if (erro) return <Card role="alert" className="border-danger bg-danger-bg text-sm text-danger">{erro}</Card>;
  if (!itens) return <Card className="h-24 animate-pulse bg-surface-2" aria-busy="true">{null}</Card>;
  if (itens.length === 0) {
    return (
      <Card className="max-w-3xl text-sm text-muted">
        Você ainda não fez denúncias. Para denunciar, use o menu ⋯ de uma avaliação ou o link na página de um perfil.
      </Card>
    );
  }

  return (
    <ul className="flex max-w-3xl flex-col gap-3">
      {itens.map((d) => (
        <li key={d.id}>
          <Card className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-medium text-foreground">{d.alvoRotulo}</span>
              <Badge tom={tomDoStatus(d.status)}>{ROTULOS_STATUS_DENUNCIA[d.status] ?? d.status}</Badge>
              <span className="text-xs text-muted">
                {rotuloMotivoDenuncia(d.motivo)} · {formatarDataBr(d.criadoEm)}
              </span>
            </div>
            {d.mensagem && (
              <div className="rounded-lg border-l-2 border-primary bg-surface px-3 py-2">
                <p className="text-xs text-muted">Mensagem da moderação</p>
                <p className="whitespace-pre-line text-sm text-foreground/90">{d.mensagem}</p>
              </div>
            )}
            {d.status === "aguardando_informacoes" && <Complemento denuncia={d} aoEnviar={carregar} />}
          </Card>
        </li>
      ))}
    </ul>
  );
}
