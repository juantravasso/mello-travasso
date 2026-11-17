"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  alternarAvisosWhatsapp,
  desvincularWhatsapp,
  iniciarVinculoWhatsapp,
  obterVinculoWhatsapp,
  type VinculoIniciado,
  type VinculoParaTela,
} from "@/services/data/server/whatsappActions";

const INTERVALO_MS = 4000;

/** Vincula o WhatsApp da pessoa ao Elo: ela envia um código ao número do Elo (o Elo nunca escreve primeiro). */
export function VinculoWhatsapp() {
  const [estado, setEstado] = useState<VinculoParaTela | null>(null);
  const [iniciado, setIniciado] = useState<VinculoIniciado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, executar] = useTransition();
  const aguardando = !!iniciado && estado?.vinculado !== true;

  useEffect(() => {
    let cancelado = false;
    obterVinculoWhatsapp()
      .then((r) => {
        if (cancelado) return;
        if (r.ok) setEstado(r.dados);
        else setErro(r.mensagem);
      })
      .catch(() => {
        if (!cancelado) setErro("Não foi possível carregar o WhatsApp agora.");
      });
    return () => {
      cancelado = true;
    };
  }, []);

  // Enquanto espera a mensagem chegar, confere sozinho se o vínculo já foi feito.
  useEffect(() => {
    if (!aguardando) return;
    const id = window.setInterval(async () => {
      try {
        const r = await obterVinculoWhatsapp();
        if (r.ok) {
          setEstado(r.dados);
          if (r.dados.vinculado) setIniciado(null);
        }
      } catch {
        // Falha de rede: tenta de novo na próxima volta.
      }
    }, INTERVALO_MS);
    return () => window.clearInterval(id);
  }, [aguardando]);

  if (!estado) return erro ? <p role="alert" className="text-sm text-danger">{erro}</p> : null;
  if (!estado.disponivel) return null;

  function vincular() {
    setErro(null);
    executar(async () => {
      const r = await iniciarVinculoWhatsapp();
      if (r.ok) setIniciado(r.dados);
      else setErro(r.mensagem);
    });
  }

  function alternarAvisos() {
    if (!estado) return;
    const proximo = !estado.avisosAtivos;
    setEstado({ ...estado, avisosAtivos: proximo });
    executar(async () => {
      const r = await alternarAvisosWhatsapp(proximo);
      if (!r.ok) {
        setEstado((e) => (e ? { ...e, avisosAtivos: !proximo } : e));
        setErro(r.mensagem);
      }
    });
  }

  function desvincular() {
    setErro(null);
    executar(async () => {
      const r = await desvincularWhatsapp();
      if (r.ok) setEstado((e) => (e ? { ...e, vinculado: false, avisosAtivos: false, numeroMascarado: null, aguardando: false } : e));
      else setErro(r.mensagem);
    });
  }

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <p className="font-medium text-foreground">WhatsApp</p>
        <p className="text-sm text-muted">Receba por aqui os avisos da sua conta, como o fim do teste e o vencimento do plano. Nós nunca escrevemos antes de você enviar o código.</p>
      </div>

      {estado.vinculado ? (
        <>
          <p className="text-sm text-foreground" role="status">
            WhatsApp vinculado{estado.numeroMascarado ? `: ${estado.numeroMascarado}` : ""}.
          </p>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-foreground">
            <input type="checkbox" checked={estado.avisosAtivos} disabled={pendente} onChange={alternarAvisos} className="h-4 w-4 accent-[var(--color-primary)]" />
            Receber os avisos da conta por WhatsApp
          </label>
          <div>
            <Button variante="outline" onClick={desvincular} disabled={pendente}>
              Desvincular
            </Button>
          </div>
        </>
      ) : iniciado ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-foreground">
            Toque no botão para abrir o WhatsApp com a mensagem pronta e envie. Se preferir, mande você mesmo a mensagem <span className="font-mono font-semibold">{iniciado.texto}</span> para o número do Elo.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={iniciado.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground transition-colors hover:opacity-90"
            >
              Abrir o WhatsApp
            </a>
            <Button variante="outline" onClick={vincular} disabled={pendente}>
              Gerar outro código
            </Button>
          </div>
          <p className="text-xs text-muted" role="status">
            Aguardando a sua mensagem… o código vale 30 minutos. Esta tela confirma sozinha.
          </p>
        </div>
      ) : (
        <div>
          <Button onClick={vincular} disabled={pendente}>
            {pendente ? "Gerando…" : "Vincular meu WhatsApp"}
          </Button>
        </div>
      )}

      {erro && (
        <p role="alert" className="text-sm text-danger">
          {erro}
        </p>
      )}
    </Card>
  );
}
