"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DadosExtraidosComprovante } from "@/types";
import { CameraCapture } from "@/components/camera/CameraCapture";
import { ConfirmacaoExtracao, type DadosConfirmados } from "@/components/camera/ConfirmacaoExtracao";
import { PassosCaptura } from "@/components/camera/PassosCaptura";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { useStatusPlano } from "@/components/layout/StatusPlanoContext";
import { extrairDadosDoComprovante } from "@/services/ai/reciboReader";
import { capturaRepositorio } from "@/services/data";
import { blobParaDataUrl } from "@/lib/imagem";

type Etapa = "captura" | "revisao";

export default function PaginaCaptura() {
  const router = useRouter();
  const { somenteLeitura } = useStatusPlano();
  const [etapa, setEtapa] = useState<Etapa>("captura");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [carregandoIA, setCarregandoIA] = useState(false);
  const [erroIA, setErroIA] = useState<string | null>(null);
  const [dadosExtraidos, setDadosExtraidos] = useState<DadosExtraidosComprovante | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erroAoSalvar, setErroAoSalvar] = useState<string | null>(null);

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
    setErroAoSalvar(null);
  }

  async function salvarConta(dados: DadosConfirmados) {
    setEnviando(true);
    setErroAoSalvar(null);
    try {
      // Tudo vai numa chamada só: o servidor grava a conta (ou as parcelas), o rateio entre destinos, os itens e a
      // entrada no estoque na mesma transação. Mesmo vindo de um comprovante (que em tese já foi pago), a conta
      // nasce em aberto — só é marcada como paga quando alguém revisa e completa o cadastro (ver ContaDetalhe).
      const resultado = await capturaRepositorio.registrar({
        tipoDocumento: dados.tipoDocumento,
        obraId: dados.obraId,
        valor: dados.valor,
        data: dados.data,
        favorecido: dados.favorecido,
        fornecedorId: dados.fornecedorId,
        descricao: dados.descricao,
        categoria: dados.categoria,
        formaPagamento: dados.formaPagamento,
        observacao: dados.observacao,
        comprovanteUrl: previewUrl,
        itens: dados.itens.map((item) => ({
          descricao: item.descricao.trim(),
          quantidade: item.quantidade,
          unidade: item.unidade,
          valorUnitario: item.valorUnitario,
          valorTotal: item.valorTotal,
          obraId: item.obraId,
        })),
        parcelas: dados.parcelas,
      });
      if (!resultado.ok) {
        setErroAoSalvar(resultado.mensagem);
        return;
      }
      router.push("/contas-a-pagar");
    } finally {
      setEnviando(false);
    }
  }

  if (somenteLeitura) {
    return (
      <div className="mx-auto max-w-xl animar-entrada">
        <PageHeader titulo="Captura de documentos" />
        <Card className="flex flex-col gap-2">
          <p className="font-medium text-foreground">Teste encerrado</p>
          <p className="text-sm text-muted">
            Os dados continuam disponíveis para consulta. Para voltar a capturar comprovantes, fale com a equipe.
          </p>
        </Card>
      </div>
    );
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
          erroAoSalvar={erroAoSalvar}
        />
      )}
    </div>
  );
}
