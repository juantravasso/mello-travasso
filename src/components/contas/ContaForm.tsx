"use client";

import { useState } from "react";
import type { NovaContaFinanceiraInput, Obra, TipoConta } from "@/types";
import { useCatalogoCategorias, useCatalogoFormasPagamento } from "@/hooks/useCatalogo";
import { useFornecedores } from "@/hooks/useFornecedores";
import { useObras } from "@/hooks/useObras";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { ModalParcelamento, type ParcelaEditavel } from "./ModalParcelamento";
import { SelectComCriacao } from "./SelectComCriacao";
import { SelectFornecedor } from "./SelectFornecedor";
import { SelectProjeto } from "./SelectProjeto";
import { FORMAS_PAGAMENTO_PARCELAVEIS } from "@/lib/categorias";
import { hojeISO } from "@/lib/formatadores";
import { blobParaDataUrl } from "@/lib/imagem";

interface ContaFormProps {
  tipo: TipoConta;
  obras: Obra[];
  onSalvar: (inputs: NovaContaFinanceiraInput[]) => Promise<void>;
  onCancelar: () => void;
}

export function ContaForm({ tipo, obras, onSalvar, onCancelar }: ContaFormProps) {
  const categoriasCatalogo = useCatalogoCategorias(tipo);
  const formasCatalogo = useCatalogoFormasPagamento();
  const { fornecedores, criarFornecedor, atualizarFornecedor } = useFornecedores();
  // A lista de projetos vem de quem abriu o formulário; o hook traz criar e editar, e a lista já com o que mudou aqui.
  const { obras: obrasAtuais, criarObra, atualizarObra } = useObras();
  const opcoesDeProjeto = obrasAtuais.length > 0 ? obrasAtuais : obras;

  const [obraId, setObraId] = useState(obras[0]?.id ?? "");
  const [valor, setValor] = useState("");
  const [dataLancamento, setDataLancamento] = useState(hojeISO());
  const [dataVencimento, setDataVencimento] = useState(hojeISO());
  const [favorecidoOuCliente, setFavorecidoOuCliente] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [observacao, setObservacao] = useState("");
  const [comprovanteUrl, setComprovanteUrl] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [parcelas, setParcelas] = useState<ParcelaEditavel[] | null>(null);
  const [modalParcelamentoAberto, setModalParcelamentoAberto] = useState(false);

  const podeParcelar = FORMAS_PAGAMENTO_PARCELAVEIS.includes(formaPagamento);
  const valido = Number(valor) > 0 && obraId !== "" && favorecidoOuCliente.trim() !== "";

  async function aoSelecionarComprovante(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (arquivo) setComprovanteUrl(await blobParaDataUrl(arquivo));
  }

  function aoMudarFormaPagamento(novoValor: string) {
    setFormaPagamento(novoValor);
    if (!FORMAS_PAGAMENTO_PARCELAVEIS.includes(novoValor)) setParcelas(null);
  }

  function base(): Omit<NovaContaFinanceiraInput, "valor" | "dataVencimento" | "descricao" | "parcela" | "parcelamentoId"> {
    return {
      tipo,
      obraId,
      dataLancamento,
      favorecidoOuCliente: favorecidoOuCliente.trim(),
      fornecedorId: tipo === "pagar" ? fornecedorId || undefined : undefined,
      categoria: categoria || undefined,
      formaPagamento: formaPagamento || undefined,
      observacao: observacao.trim() || undefined,
      comprovanteUrl,
      origemNotaFiscal: false,
      precisaCompletarCadastro: false,
    };
  }

  async function submeter() {
    if (!valido) return;
    setSalvando(true);
    try {
      if (parcelas && parcelas.length > 1) {
        const parcelamentoId = crypto.randomUUID();
        const inputs: NovaContaFinanceiraInput[] = parcelas.map((parcela, indice) => ({
          ...base(),
          valor: parcela.valor,
          dataVencimento: parcela.dataVencimento,
          descricao: `${descricao.trim() || favorecidoOuCliente.trim()} (parcela ${indice + 1}/${parcelas.length})`,
          parcelamentoId,
          parcela: { numero: indice + 1, totalParcelas: parcelas.length },
        }));
        await onSalvar(inputs);
      } else {
        await onSalvar([
          {
            ...base(),
            valor: Number(valor),
            dataVencimento,
            descricao: descricao.trim(),
          },
        ]);
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <SelectProjeto
          label="Projeto"
          value={obraId}
          onChange={setObraId}
          opcoes={opcoesDeProjeto}
          criarObra={criarObra}
          atualizarObra={atualizarObra}
          rotuloVazio="Selecione o projeto"
        />
        {tipo === "pagar" ? (
          <SelectFornecedor
            label="Fornecedor/Favorecido"
            fornecedores={fornecedores}
            fornecedorId={fornecedorId}
            onSelecionar={(f) => {
              setFornecedorId(f.id);
              setFavorecidoOuCliente(f.nome);
            }}
            onCriar={(nome) => criarFornecedor({ nome })}
            onAtualizar={atualizarFornecedor}
          />
        ) : (
          <Input
            label="Cliente"
            value={favorecidoOuCliente}
            onChange={(e) => setFavorecidoOuCliente(e.target.value)}
          />
        )}
        <Input label="Valor (R$)" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
        <Input label="Data de lançamento" type="date" value={dataLancamento} onChange={(e) => setDataLancamento(e.target.value)} />
        <Input
          label={tipo === "pagar" ? "Data de vencimento" : "Data prevista"}
          type="date"
          value={dataVencimento}
          onChange={(e) => setDataVencimento(e.target.value)}
        />
        <SelectComCriacao
          label="Categoria"
          rotuloVazio="Selecione a categoria"
          value={categoria}
          onChange={setCategoria}
          opcoes={categoriasCatalogo.opcoes}
          onCriar={categoriasCatalogo.criar}
          onRenomear={categoriasCatalogo.renomear}
          tituloModal="Nova categoria"
        />
        <SelectComCriacao
          label="Forma de pagamento"
          rotuloVazio="Selecione a forma de pagamento"
          value={formaPagamento}
          onChange={aoMudarFormaPagamento}
          opcoes={formasCatalogo.opcoes}
          onCriar={formasCatalogo.criar}
          onRenomear={formasCatalogo.renomear}
          tituloModal="Nova forma de pagamento"
        />
        {podeParcelar && (
          <Button variante="outline" tamanho="sm" className="md:self-end" onClick={() => setModalParcelamentoAberto(true)}>
            {parcelas ? `Parcelado em ${parcelas.length}x` : "Parcelar pagamento"}
          </Button>
        )}
      </div>
      <Textarea label="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      <Textarea label="Observação" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-foreground">Comprovante (opcional)</span>
        <input type="file" accept="image/*" onChange={aoSelecionarComprovante} className="text-sm" />
      </label>

      <div className="flex gap-3 pt-2">
        <Button variante="outline" className="flex-1" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </Button>
        <Button className="flex-1" onClick={submeter} disabled={!valido || salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </Button>
      </div>

      {modalParcelamentoAberto && (
        <ModalParcelamento
          valorTotal={Number(valor) || 0}
          dataVencimentoInicial={dataVencimento}
          parcelasIniciais={parcelas ?? undefined}
          onFechar={() => setModalParcelamentoAberto(false)}
          onConfirmar={(novasParcelas) => {
            setParcelas(novasParcelas);
            setModalParcelamentoAberto(false);
          }}
        />
      )}
    </div>
  );
}
