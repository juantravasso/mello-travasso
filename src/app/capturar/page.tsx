"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DadosExtraidosComprovante, NovaContaFinanceiraInput } from "@/types";
import { CameraCapture } from "@/components/camera/CameraCapture";
import { ConfirmacaoExtracao, type DadosConfirmados } from "@/components/camera/ConfirmacaoExtracao";
import { PassosCaptura } from "@/components/camera/PassosCaptura";
import { PageHeader } from "@/components/layout/PageHeader";
import { extrairDadosDoComprovante } from "@/services/ai/reciboReader";
import { contasRepositorio, itensProdutoRepositorio } from "@/services/data";
import { useUsuarioAtual } from "@/hooks/useUsuarioAtual";
import { blobParaDataUrl } from "@/lib/imagem";
import { hojeISO } from "@/lib/formatadores";

type Etapa = "captura" | "revisao";

export default function PaginaCaptura() {
  const router = useRouter();
  const { usuarioOuPadrao } = useUsuarioAtual();
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
      const base: Omit<NovaContaFinanceiraInput, "valor" | "dataVencimento" | "descricao" | "parcela" | "parcelamentoId"> = {
        tipo: "pagar",
        obraId: dados.obraId,
        dataLancamento: hojeISO(),
        favorecidoOuCliente: dados.favorecido,
        categoria: dados.categoria,
        formaPagamento: dados.formaPagamento,
        observacao: dados.observacao,
        comprovanteUrl: previewUrl,
        origemNotaFiscal: dados.tipoDocumento === "nota_fiscal",
        // Lançamentos vindos da câmera ficam sinalizados para alguém revisar
        // e completar categoria/forma de pagamento/observação com calma depois.
        precisaCompletarCadastro: true,
      };

      const temParcelamento = dados.parcelas && dados.parcelas.length > 1;
      let primeiraConta;

      if (temParcelamento && dados.parcelas) {
        const parcelamentoId = crypto.randomUUID();
        for (const [indice, parcela] of dados.parcelas.entries()) {
          const conta = await contasRepositorio.criar(
            {
              ...base,
              valor: parcela.valor,
              dataVencimento: parcela.dataVencimento,
              descricao: `${dados.descricao} (parcela ${indice + 1}/${dados.parcelas.length})`,
              parcelamentoId,
              parcela: { numero: indice + 1, totalParcelas: dados.parcelas.length },
            },
            usuarioOuPadrao,
          );
          if (indice === 0) primeiraConta = conta;
        }
      } else {
        // Mesmo vindo de um comprovante (que em tese já foi pago), a conta
        // nasce em aberto — só é marcada como paga quando alguém revisa e
        // completa o cadastro (ver ContaDetalhe), para não assumir uma baixa
        // que ninguém confirmou de fato.
        primeiraConta = await contasRepositorio.criar(
          { ...base, valor: dados.valor, dataVencimento: dados.data, descricao: dados.descricao },
          usuarioOuPadrao,
        );
      }

      if (dados.tipoDocumento === "nota_fiscal" && dados.itens.length > 0 && primeiraConta) {
        await itensProdutoRepositorio.criarEmLote(
          dados.itens
            .filter((item) => item.descricao.trim() !== "")
            .map((item) => ({
              contaFinanceiraId: primeiraConta.id,
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
