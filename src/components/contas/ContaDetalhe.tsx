"use client";

import { useState } from "react";
import Link from "next/link";
import { useConta } from "@/hooks/useConta";
import { useObras } from "@/hooks/useObras";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { StatusContaBadge } from "@/components/ui/StatusContaBadge";
import { rotulosCategoria } from "@/lib/categorias";
import { formatarData, formatarMoeda, hojeISO } from "@/lib/formatadores";

export function ContaDetalhe({ contaId }: { contaId: string }) {
  const { conta, carregando, darBaixa } = useConta(contaId);
  const { obras } = useObras();
  const [dataBaixa, setDataBaixa] = useState(hojeISO());
  const [baixando, setBaixando] = useState(false);

  if (carregando) return <p className="text-sm text-muted">Carregando…</p>;
  if (!conta) return <p className="text-sm text-danger">Conta não encontrada.</p>;

  const obra = obras.find((o) => o.id === conta.obraId);
  const rotuloParte = conta.tipo === "pagar" ? "Favorecido" : "Cliente";
  const rotuloAcao = conta.tipo === "pagar" ? "Dar baixa (marcar como paga)" : "Marcar como recebida";

  async function confirmarBaixa() {
    setBaixando(true);
    try {
      await darBaixa({ contaId, dataBaixa });
    } finally {
      setBaixando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {conta.comprovanteUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={conta.comprovanteUrl}
          alt="Comprovante"
          className="max-h-[50vh] w-full rounded-xl border border-border object-contain bg-muted-bg"
        />
      )}

      <Card className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-2xl font-semibold">{formatarMoeda(conta.valor)}</span>
          <StatusContaBadge status={conta.status} tipo={conta.tipo} />
        </div>
        <DetalheLinha rotulo={rotuloParte} valor={conta.favorecidoOuCliente} />
        <DetalheLinha rotulo="Descrição" valor={conta.descricao} />
        {conta.categoria && <DetalheLinha rotulo="Categoria" valor={rotulosCategoria[conta.categoria]} />}
        <DetalheLinha
          rotulo="Obra"
          valor={obra ? <Link href={`/obras/${obra.id}`} className="text-primary underline">{obra.nome}</Link> : "—"}
        />
        <DetalheLinha rotulo="Data de vencimento" valor={formatarData(conta.dataVencimento)} />
        {conta.dataBaixa && <DetalheLinha rotulo="Data de baixa" valor={formatarData(conta.dataBaixa)} />}
        {conta.origemNotaFiscal && <DetalheLinha rotulo="Origem" valor="Nota fiscal" />}
      </Card>

      {conta.status === "em_aberto" && (
        <Card className="flex flex-col gap-3">
          <Input label="Data" type="date" value={dataBaixa} onChange={(e) => setDataBaixa(e.target.value)} />
          <Button onClick={confirmarBaixa} disabled={baixando}>
            {baixando ? "Salvando…" : rotuloAcao}
          </Button>
        </Card>
      )}
    </div>
  );
}

function DetalheLinha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">{rotulo}</span>
      <span className="text-right font-medium">{valor}</span>
    </div>
  );
}
