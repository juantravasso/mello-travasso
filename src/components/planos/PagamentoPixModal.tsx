"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
/* eslint-disable @next/next/no-img-element -- QR vem do Mercado Pago em base64; não há otimização possível. */
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatarPreco } from "@/lib/planos/comercial";
import { verificarPagamentoPix, type EstadoPix, type PixIniciado } from "@/services/data/server/assinaturaComercialActions";

const INTERVALO_MS = 4000;

function restante(expiraEm: string): string {
  const s = Math.max(0, Math.floor((new Date(expiraEm).getTime() - Date.now()) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Pix dentro do site: QR, "copia e cola" e confirmação automática (a tela confere o pagamento sozinha). */
export function PagamentoPixModal({ pix, titulo, onFechar }: { pix: PixIniciado; titulo: string; onFechar: () => void }) {
  const [estado, setEstado] = useState<EstadoPix>("aguardando");
  const [copiado, setCopiado] = useState(false);
  const [tempo, setTempo] = useState(() => restante(pix.expiraEm));
  const router = useRouter();
  const estadoRef = useRef(estado);
  useEffect(() => {
    estadoRef.current = estado;
  }, [estado]);

  useEffect(() => {
    const relogio = window.setInterval(() => setTempo(restante(pix.expiraEm)), 1000);
    const conferencia = window.setInterval(async () => {
      if (estadoRef.current !== "aguardando") return;
      if (Date.now() > new Date(pix.expiraEm).getTime() + 60_000) {
        setEstado("expirado");
        return;
      }
      try {
        const r = await verificarPagamentoPix(pix.reservaId);
        if (r.ok) setEstado(r.dados.estado);
      } catch {
        // Falha de rede: tenta de novo na próxima volta.
      }
    }, INTERVALO_MS);
    return () => {
      window.clearInterval(relogio);
      window.clearInterval(conferencia);
    };
  }, [pix.reservaId, pix.expiraEm]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(pix.copiaECola);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(false);
    }
  }

  function concluir() {
    if (estado === "pago") {
      router.push("/");
      router.refresh();
    } else onFechar();
  }

  return (
    <Modal titulo={titulo} onFechar={concluir}>
      {estado === "pago" ? (
        <div className="flex flex-col gap-3" role="status">
          <p className="text-lg font-semibold text-success">Pagamento confirmado!</p>
          <p className="text-sm text-foreground">Seu plano já está ativo. Obrigado por assinar o Elo Negócios.</p>
          <Button onClick={concluir}>Começar a usar</Button>
        </div>
      ) : estado === "sem_vaga" ? (
        <div className="flex flex-col gap-3" role="alert">
          <p className="font-semibold text-danger">O pagamento chegou, mas a vaga deste plano acabou.</p>
          <p className="text-sm text-foreground">Fale com a equipe: devolvemos o valor ou colocamos você em outro plano.</p>
          <Button variante="outline" onClick={onFechar}>
            Fechar
          </Button>
        </div>
      ) : estado === "expirado" ? (
        <div className="flex flex-col gap-3" role="alert">
          <p className="font-semibold text-foreground">Este Pix expirou.</p>
          <p className="text-sm text-muted">Se você já pagou, aguarde um instante: a confirmação pode demorar um pouco. Se não, gere um novo Pix.</p>
          <Button onClick={onFechar}>Fechar</Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-3xl font-bold tabular-nums text-foreground">{formatarPreco(pix.valorCentavos)}</p>
          <img src={`data:image/png;base64,${pix.qrCodeBase64}`} alt="QR Code do Pix" width={220} height={220} className="h-56 w-56 rounded-lg border border-border bg-white p-2" />
          <p className="text-sm text-muted">Abra o app do seu banco, escolha pagar com Pix e leia o QR Code. Ou use o código abaixo.</p>
          <div className="flex w-full flex-col gap-2">
            <p className="break-all rounded-lg border border-border bg-surface-2 p-2 text-left font-mono text-xs text-foreground" aria-label="Pix copia e cola">
              {pix.copiaECola}
            </p>
            <Button onClick={copiar}>{copiado ? "Código copiado!" : "Copiar código Pix"}</Button>
          </div>
          <p className="text-xs text-muted" role="status">
            Aguardando o pagamento… expira em <span className="tabular-nums">{tempo}</span>. Esta tela confirma sozinha, não precisa recarregar.
          </p>
        </div>
      )}
    </Modal>
  );
}
