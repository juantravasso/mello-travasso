"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DadosExtraidosComprovante } from "@/types";
import { CameraCapture } from "@/components/camera/CameraCapture";
import { ConfirmacaoExtracao, type DadosConfirmados } from "@/components/camera/ConfirmacaoExtracao";
import { PassosCaptura } from "@/components/camera/PassosCaptura";
import { PageHeader } from "@/components/layout/PageHeader";
import { extrairDadosDoComprovante } from "@/services/ai/reciboReader";
import { contasRepositorio, itensProdutoRepositorio } from "@/services/data";
import { blobParaDataUrl } from "@/lib/imagem";

type Etapa = "captura" | "revisao";

export default function PaginaCaptura() {
  const router = useRouter();
  const [etapa, setEtapa] = useState<Etapa>("captura");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [carregandoIA, setCarregandoIA] = useState(false);
  const [erroIA, setErroIA] = useState<string | null>(null);
  const [dadosExtraidos, setDadosExtraidos] = useState<DadosExtraidosComprovante | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function aoConfirmarFoto(foto: Blob) {
    const dataUrl = await blobParaDataUrl(foto);
    setPreviewUrl(dataUrl);
    setEtapa("revisao");
    setCarregandoIA(true);
    setErroIA(null);
    setDadosExtraidos(null);

    const resultado = await extrairDadosDoComprovante(foto);
    setCarregandoIA(false);
    if (resultado.sucesso && resultado.dados) {
      setDadosExtraidos(resultado.dados);
    } else {
      setErroIA(resultado.erro ?? "Não foi possível ler o documento automaticamente.");
    }
  }

  function cancelarRevisao() {
    setEtapa("captura");
    setPreviewUrl("");
    setDadosExtraidos(null);
    setErroIA(null);
  }

  async function salvarConta(dados: DadosConfirmados) {
    setEnviando(true);
    try {
      const conta = await contasRepositorio.criar({
        tipo: "pagar",
        obraId: dados.obraId,
        valor: dados.valor,
        dataVencimento: dados.data,
        favorecidoOuCliente: dados.favorecido,
        descricao: dados.descricao,
        categoria: dados.categoria,
        comprovanteUrl: previewUrl,
        origemNotaFiscal: dados.tipoDocumento === "nota_fiscal",
      });

      if (dados.tipoDocumento === "comprovante") {
        await contasRepositorio.baixar({ contaId: conta.id, dataBaixa: dados.data });
      }

      if (dados.tipoDocumento === "nota_fiscal" && dados.itens.length > 0) {
        await itensProdutoRepositorio.criarEmLote(
          dados.itens
            .filter((item) => item.descricao.trim() !== "")
            .map((item) => ({
              contaFinanceiraId: conta.id,
              obraId: dados.obraId,
              descricao: item.descricao.trim(),
              quantidade: item.quantidade,
              unidade: item.unidade,
              valorUnitario: item.valorUnitario,
              valorTotal: item.valorTotal,
              dataCompra: dados.data,
              fornecedor: dados.favorecido,
            })),
        );
      }

      router.push("/contas-a-pagar");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl animar-entrada">
      <PageHeader titulo="Captura de documentos" />
      <PassosCaptura passoAtual={etapa === "captura" ? 1 : 2} />
      {etapa === "captura" ? (
        <CameraCapture onFotoConfirmada={aoConfirmarFoto} />
      ) : (
        <ConfirmacaoExtracao
          previewUrl={previewUrl}
          carregandoIA={carregandoIA}
          erroIA={erroIA}
          dadosExtraidos={dadosExtraidos}
          onConfirmar={salvarConta}
          onCancelar={cancelarRevisao}
          enviando={enviando}
        />
      )}
    </div>
  );
}
