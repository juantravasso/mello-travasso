"use client";

import { useState } from "react";
import Link from "next/link";
import type { ContaFinanceira, Obra } from "@/types";
import { Card } from "@/components/ui/Card";
import { PrecisaCompletarBadge } from "@/components/ui/PrecisaCompletarBadge";
import { StatusContaBadge } from "@/components/ui/StatusContaBadge";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { formatarData, formatarMoeda } from "@/lib/formatadores";

export function ContaListItem({ conta, obra }: { conta: ContaFinanceira; obra?: Obra }) {
  const [lightboxAberto, setLightboxAberto] = useState(false);

  return (
    <Card className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => conta.comprovanteUrl && setLightboxAberto(true)}
        className="h-16 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-border bg-muted-bg"
      >
        {conta.comprovanteUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={conta.comprovanteUrl} alt="Comprovante" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center text-[10px] text-muted">sem foto</span>
        )}
      </button>

      <Link href={`/${conta.tipo === "pagar" ? "contas-a-pagar" : "contas-a-receber"}/${conta.id}`} className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {conta.favorecidoOuCliente}
          {conta.parcela && (
            <span className="ml-1.5 text-xs font-normal text-muted">
              ({conta.parcela.numero}/{conta.parcela.totalParcelas})
            </span>
          )}
        </p>
        <p className="truncate text-sm text-muted">{conta.descricao}</p>
        {obra && <p className="truncate text-xs text-muted">{obra.nome}</p>}
      </Link>

      <div className="flex flex-shrink-0 flex-col items-end gap-1">
        <span className="font-semibold">{formatarMoeda(conta.valor)}</span>
        <span className="text-xs text-muted">{formatarData(conta.dataVencimento)}</span>
        <StatusContaBadge status={conta.status} tipo={conta.tipo} />
        {conta.precisaCompletarCadastro && <PrecisaCompletarBadge />}
      </div>

      {lightboxAberto && conta.comprovanteUrl && (
        <ImageLightbox url={conta.comprovanteUrl} onFechar={() => setLightboxAberto(false)} />
      )}
    </Card>
  );
}
