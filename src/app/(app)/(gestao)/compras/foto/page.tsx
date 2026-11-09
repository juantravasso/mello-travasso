"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DadosExtraidosComprovante } from "@/types";
import { CameraCapture } from "@/components/camera/CameraCapture";
import { CompraForm } from "@/components/compras/CompraForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { useStatusPlano } from "@/components/layout/StatusPlanoContext";
import { Card } from "@/components/ui/Card";
import { extrairDadosDoComprovante } from "@/services/ai/reciboReader";
import { blobParaDataUrl } from "@/lib/imagem";

/** Compra por foto da nota: a IA lê o documento, o formulário vem preenchido e os itens já tentam se identificar sozinhos. */
export default function CompraPorFotoPage() {
  const router = useRouter();
  const { somenteLeitura } = useStatusPlano();
  const [foto, setFoto] = useState<string | null>(null);
  const [dados, setDados] = useState<DadosExtraidosComprovante | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function aoConfirmarFoto(blob: Blob) {
    setFoto(await blobParaDataUrl(blob));
    setAviso("Lendo a nota com IA…");
    const r = await extrairDadosDoComprovante(blob);
    if (r.sucesso && r.dados) {
      setDados(r.dados);
      setAviso(null);
    } else {
      setAviso(`${r.erro ?? "Não foi possível ler o documento automaticamente."} Preencha os campos abaixo.`);
    }
  }

  if (somenteLeitura) {
    return (
      <div className="mx-auto max-w-xl animar-entrada">
        <PageHeader titulo="Compra por foto" />
        <Card className="text-sm text-muted">Somente leitura: para lançar compras, fale com a equipe.</Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl animar-entrada">
      <PageHeader titulo="Compra por foto" />
      {foto === null ? (
        <CameraCapture onFotoConfirmada={(b) => void aoConfirmarFoto(b)} />
      ) : (
        <CompraForm origem="foto" dadosExtraidos={dados} comprovanteUrl={foto} avisoLeitura={aviso} onCancelar={() => router.push("/compras")} />
      )}
    </div>
  );
}
