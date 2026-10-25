"use client";

import { useEffect, useRef, useState } from "react";
import type { CategoriaContaPagar, DadosExtraidosComprovante, FormaPagamento, TipoDocumentoCapturado } from "@/types";
import { useCatalogoCategorias, useCatalogoFormasPagamento } from "@/hooks/useCatalogo";
import { useFornecedores } from "@/hooks/useFornecedores";
import { useObras } from "@/hooks/useObras";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { ModalParcelamento, type ParcelaEditavel } from "@/components/contas/ModalParcelamento";
import { SelectComCriacao } from "@/components/contas/SelectComCriacao";
import { SelectFornecedor } from "@/components/contas/SelectFornecedor";
import { SelectProjeto } from "@/components/contas/SelectProjeto";
import { FORMAS_PAGAMENTO_PARCELAVEIS, categoriasPagar } from "@/lib/categorias";
import { formatarMoeda, hojeISO } from "@/lib/formatadores";
import { ratearConta } from "@/lib/estoque/rateio";
import { cn } from "@/lib/cn";

export interface ItemNotaFiscalEditavel {
  descricao: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  valorTotal: number;
  /** Para onde o item vai (projeto ou Depósito). Vazio na tela = o mesmo destino geral; ao confirmar já vem resolvido. */
  obraId: string;
}

export interface DadosConfirmados {
  tipoDocumento: TipoDocumentoCapturado;
  valor: number;
  data: string;
  favorecido: string;
  fornecedorId?: string;
  descricao: string;
  categoria?: CategoriaContaPagar;
  formaPagamento?: FormaPagamento;
  observacao?: string;
  obraId: string;
  itens: ItemNotaFiscalEditavel[];
  parcelas?: ParcelaEditavel[];
}

interface ConfirmacaoExtracaoProps {
  /** Vazio no lançamento manual (sem foto): a tela não mostra a imagem nem a leitura por IA. */
  previewUrl: string;
  carregandoIA: boolean;
  erroIA: string | null;
  dadosExtraidos: DadosExtraidosComprovante | null;
  onConfirmar: (dados: DadosConfirmados) => void;
  onCancelar: () => void;
  enviando: boolean;
  /** Mensagem do servidor quando não foi possível salvar. */
  erroAoSalvar?: string | null;
}

function itemVazio(): ItemNotaFiscalEditavel {
  return { descricao: "", quantidade: 1, unidade: "un", valorUnitario: 0, valorTotal: 0, obraId: "" };
}

export function ConfirmacaoExtracao({
  previewUrl,
  carregandoIA,
  erroIA,
  dadosExtraidos,
  onConfirmar,
  onCancelar,
  enviando,
  erroAoSalvar,
}: ConfirmacaoExtracaoProps) {
  const { obras, locais, deposito, criarObra, atualizarObra } = useObras();
  const categoriasCatalogo = useCatalogoCategorias("pagar");
  const formasCatalogo = useCatalogoFormasPagamento();
  const { fornecedores, criarFornecedor, resolverFornecedor, atualizarFornecedor } = useFornecedores();
  const dadosJaResolvidosRef = useRef<DadosExtraidosComprovante | null>(null);

  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumentoCapturado>("comprovante");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hojeISO());
  const [favorecido, setFavorecido] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState<CategoriaContaPagar | "">("");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento | "">("");
  const [observacao, setObservacao] = useState("");
  const [obraId, setObraId] = useState("");
  const [itens, setItens] = useState<ItemNotaFiscalEditavel[]>([]);
  const [camposDestacados, setCamposDestacados] = useState<string[]>([]);
  const [parcelas, setParcelas] = useState<ParcelaEditavel[] | null>(null);
  const [modalParcelamentoAberto, setModalParcelamentoAberto] = useState(false);
  const [resolvendoFornecedor, setResolvendoFornecedor] = useState(false);

  useEffect(() => {
    if (!dadosExtraidos) return;
    setTipoDocumento(dadosExtraidos.tipoDocumento);
    if (dadosExtraidos.valor !== undefined) setValor(String(dadosExtraidos.valor));
    if (dadosExtraidos.data) setData(dadosExtraidos.data);
    if (dadosExtraidos.favorecido) setFavorecido(dadosExtraidos.favorecido);
    if (dadosExtraidos.descricao) setDescricao(dadosExtraidos.descricao);
    if (dadosExtraidos.categoriaSugerida) {
      const sugerida = dadosExtraidos.categoriaSugerida as CategoriaContaPagar;
      if (categoriasPagar.includes(sugerida)) setCategoria(sugerida);
    }
    if (dadosExtraidos.itens?.length) {
      setItens(
        dadosExtraidos.itens.map((item) => ({
          descricao: item.descricao ?? "",
          quantidade: item.quantidade ?? 1,
          unidade: item.unidade ?? "un",
          valorUnitario: item.valorUnitario ?? 0,
          valorTotal: item.valorTotal ?? 0,
          obraId: "",
        })),
      );
    }
    setCamposDestacados(dadosExtraidos.camposComBaixaConfianca);
  }, [dadosExtraidos]);

  useEffect(() => {
    if (!obraId && obras.length > 0 && obras[0]) setObraId(obras[0].id);
  }, [obras, obraId]);

  useEffect(() => {
    // Identifica o fornecedor pelo CNPJ/CPF que a IA leu na nota (chave
    // confiável) ou, na falta dele, pelo nome — e já cadastra automaticamente
    // quando nenhum fornecedor existente bate, sem exigir clique manual.
    if (!dadosExtraidos) return;
    if (dadosJaResolvidosRef.current === dadosExtraidos) return;
    if (!dadosExtraidos.favorecido && !dadosExtraidos.cnpjFavorecido) return;
    dadosJaResolvidosRef.current = dadosExtraidos;

    let cancelado = false;
    setResolvendoFornecedor(true);
    resolverFornecedor(dadosExtraidos.favorecido ?? "", dadosExtraidos.cnpjFavorecido)
      .then((resolvido) => {
        if (cancelado) return;
        setFornecedorId(resolvido.id);
        setFavorecido(resolvido.nome);
      })
      .finally(() => {
        if (!cancelado) setResolvendoFornecedor(false);
      });

    return () => {
      cancelado = true;
    };
  }, [dadosExtraidos, resolverFornecedor]);

  function atualizarItem(indice: number, campo: keyof ItemNotaFiscalEditavel, valor: string) {
    setItens((atual) =>
      atual.map((item, i) => {
        if (i !== indice) return item;
        if (campo === "descricao" || campo === "unidade") {
          return { ...item, [campo]: valor };
        }
        return { ...item, [campo]: Number(valor) || 0 };
      }),
    );
  }

  /** Escolher o destino geral faz todos os itens irem para ele (cada um ainda pode ser trocado depois). */
  function aoMudarDestinoGeral(novo: string) {
    setObraId(novo);
    setItens((atual) => atual.map((item) => ({ ...item, obraId: "" })));
  }

  function aoMudarTipoDocumento(opcao: TipoDocumentoCapturado) {
    setTipoDocumento(opcao);
    // Comprovante simples não tem itens nem estoque: precisa de um projeto, não do Depósito.
    if (opcao === "comprovante" && obraId === deposito?.id) aoMudarDestinoGeral(obras[0]?.id ?? "");
  }

  function removerItem(indice: number) {
    setItens((atual) => atual.filter((_, i) => i !== indice));
  }

  const valorNumerico = Number(valor.replace(",", "."));
  const formularioValido = valorNumerico > 0 && data !== "" && favorecido.trim() !== "" && obraId !== "";

  const ehNota = tipoDocumento === "nota_fiscal";
  const opcoesDeDestino = ehNota && deposito ? [...obras, deposito] : obras;
  const nomeDoLocal = (id: string) => locais.find((l) => l.id === id)?.nome ?? "—";
  const itensComValor = itens.filter((i) => i.descricao.trim() !== "");
  // Prévia de como a nota será dividida entre os destinos dos itens (o servidor faz a mesma conta).
  const divisao = ehNota ? ratearConta(itensComValor.map((i) => ({ obraId: i.obraId || obraId, valorTotal: i.valorTotal })), valorNumerico || 0) : [];

  function aoMudarFormaPagamento(novoValor: string) {
    setFormaPagamento(novoValor);
    if (!FORMAS_PAGAMENTO_PARCELAVEIS.includes(novoValor)) setParcelas(null);
  }

  function submeter() {
    if (!formularioValido) return;
    onConfirmar({
      tipoDocumento,
      valor: valorNumerico,
      data,
      favorecido: favorecido.trim(),
      fornecedorId: fornecedorId || undefined,
      descricao: descricao.trim() || favorecido.trim(),
      categoria: categoria || undefined,
      formaPagamento: formaPagamento || undefined,
      observacao: observacao.trim() || undefined,
      obraId,
      itens: ehNota ? itensComValor.map((item) => ({ ...item, obraId: item.obraId || obraId })) : [],
      parcelas: parcelas && parcelas.length > 1 ? parcelas : undefined,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {previewUrl && (
        <div className="flex gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Comprovante fotografado"
            className="h-24 w-20 flex-shrink-0 rounded-lg border border-border object-cover"
          />
          <div className="flex flex-1 flex-col justify-center">
            {carregandoIA && <p className="text-sm text-muted">Lendo documento com IA…</p>}
            {erroIA && <p className="text-sm text-danger">{erroIA} Preencha manualmente abaixo.</p>}
            {!carregandoIA && !erroIA && dadosExtraidos && (
              <p className="text-sm text-muted">
                Confiança da leitura: {Math.round(dadosExtraidos.confiancaExtracao * 100)}%. Revise os
                campos destacados.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="inline-flex rounded-lg border border-border bg-surface p-1">
        {(["comprovante", "nota_fiscal"] as const).map((opcao) => (
          <button
            key={opcao}
            type="button"
            onClick={() => aoMudarTipoDocumento(opcao)}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              tipoDocumento === opcao ? "bg-primary text-primary-foreground" : "text-muted",
            )}
          >
            {opcao === "comprovante" ? "Comprovante simples" : "Nota fiscal"}
          </button>
        ))}
      </div>

      <Card className="flex flex-col gap-3">
        <Input
          label="Valor total (R$)"
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          destaque={camposDestacados.includes("valor")}
          placeholder="0,00"
        />
        <Input
          label="Data"
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          destaque={camposDestacados.includes("data")}
        />
        <SelectFornecedor
          label="Fornecedor"
          fornecedores={fornecedores}
          fornecedorId={fornecedorId}
          nomeSugerido={favorecido}
          onSelecionar={(f) => {
            setFornecedorId(f.id);
            setFavorecido(f.nome);
          }}
          onCriar={(nome) => criarFornecedor({ nome })}
          onAtualizar={atualizarFornecedor}
        />
        {resolvendoFornecedor && <p className="text-xs text-muted">Identificando fornecedor…</p>}
        {!resolvendoFornecedor && fornecedorId && (
          <p className="text-xs text-muted">
            Cadastro de fornecedor identificado/criado automaticamente — pode trocar acima se a IA errou.
          </p>
        )}
        <Textarea
          label="Descrição"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          destaque={camposDestacados.includes("descricao")}
          placeholder="Descrição do gasto"
        />
        <SelectProjeto
          label={ehNota ? "Destino de todos os itens" : "Projeto"}
          value={obraId}
          onChange={aoMudarDestinoGeral}
          opcoes={opcoesDeDestino}
          criarObra={criarObra}
          atualizarObra={atualizarObra}
          rotuloVazio="Selecione o projeto"
        />
        {ehNota && (
          <p className="text-xs text-muted">
            Escolha um destino para a nota inteira ou, nos itens abaixo, mande cada produto para um projeto ou para o Depósito.
          </p>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <p className="text-xs text-muted">
          Os campos abaixo são opcionais aqui — este lançamento fica marcado como &quot;completar cadastro&quot; e
          alguém pode preencher com calma depois.
        </p>
        <SelectComCriacao
          label="Categoria (opcional)"
          rotuloVazio="Completar depois"
          opcional
          value={categoria}
          onChange={(v) => setCategoria(v)}
          opcoes={categoriasCatalogo.opcoes}
          onCriar={categoriasCatalogo.criar}
          onRenomear={categoriasCatalogo.renomear}
          tituloModal="Nova categoria"
        />
        <SelectComCriacao
          label="Forma de pagamento (opcional)"
          rotuloVazio="Completar depois"
          opcional
          value={formaPagamento}
          onChange={aoMudarFormaPagamento}
          opcoes={formasCatalogo.opcoes}
          onCriar={formasCatalogo.criar}
          onRenomear={formasCatalogo.renomear}
          tituloModal="Nova forma de pagamento"
        />
        {FORMAS_PAGAMENTO_PARCELAVEIS.includes(formaPagamento) && (
          <Button variante="outline" tamanho="sm" onClick={() => setModalParcelamentoAberto(true)}>
            {parcelas ? `Parcelado em ${parcelas.length}x` : "Parcelar pagamento"}
          </Button>
        )}
        <Textarea
          label="Observação (opcional)"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Qualquer detalhe adicional sobre este gasto"
        />
      </Card>

      {tipoDocumento === "nota_fiscal" && (
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Itens da nota fiscal</h2>
            <Button variante="ghost" tamanho="sm" onClick={() => setItens((a) => [...a, itemVazio()])}>
              + Adicionar item
            </Button>
          </div>
          {itens.length === 0 && (
            <p className="text-sm text-muted">Nenhum item extraído. Adicione manualmente se necessário.</p>
          )}
          {itens.map((item, indice) => (
            <div key={indice} className="grid grid-cols-2 gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
              <Input
                label="Descrição"
                className="col-span-2"
                value={item.descricao}
                onChange={(e) => atualizarItem(indice, "descricao", e.target.value)}
              />
              <Input
                label="Quantidade"
                inputMode="decimal"
                value={String(item.quantidade)}
                onChange={(e) => atualizarItem(indice, "quantidade", e.target.value)}
              />
              <Input
                label="Unidade"
                value={item.unidade}
                onChange={(e) => atualizarItem(indice, "unidade", e.target.value)}
              />
              <Input
                label="Valor unitário (R$)"
                inputMode="decimal"
                value={String(item.valorUnitario)}
                onChange={(e) => atualizarItem(indice, "valorUnitario", e.target.value)}
              />
              <Input
                label="Valor total (R$)"
                inputMode="decimal"
                value={String(item.valorTotal)}
                onChange={(e) => atualizarItem(indice, "valorTotal", e.target.value)}
              />
              <SelectProjeto
                label="Vai para"
                className="col-span-2"
                value={item.obraId}
                onChange={(novo) => setItens((atual) => atual.map((it, i) => (i === indice ? { ...it, obraId: novo } : it)))}
                opcoes={opcoesDeDestino}
                criarObra={criarObra}
                atualizarObra={atualizarObra}
                vazioEscolhivel
                rotuloVazio={`Igual ao geral (${obraId ? (obraId === deposito?.id ? "Depósito" : nomeDoLocal(obraId)) : "—"})`}
              />
              <div className="col-span-2 flex justify-end">
                <Button variante="ghost" tamanho="sm" onClick={() => removerItem(indice)}>
                  Remover item
                </Button>
              </div>
            </div>
          ))}
          {divisao.length > 1 && (
            <div className="flex flex-col gap-1 rounded-lg border border-info/40 bg-info-bg p-3 text-sm">
              <p className="font-medium text-foreground">Esta nota será dividida entre {divisao.length} destinos</p>
              {divisao.map((d) => (
                <p key={d.obraId} className="flex justify-between gap-3 tabular-nums">
                  <span className="truncate text-muted">{d.obraId === deposito?.id ? "Depósito" : nomeDoLocal(d.obraId)}</span>
                  <span className="font-medium">{formatarMoeda(d.valor)}</span>
                </p>
              ))}
              <p className="text-xs text-muted">
                O valor de cada projeto é proporcional aos itens dele. O que for para o Depósito só vira gasto de projeto quando
                você transferir.
              </p>
            </div>
          )}
        </Card>
      )}

      {erroAoSalvar && <p className="text-sm text-danger">{erroAoSalvar}</p>}

      <div className="flex gap-3">
        <Button variante="outline" className="flex-1" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </Button>
        <Button className="flex-1" onClick={submeter} disabled={!formularioValido || enviando}>
          {enviando ? "Salvando…" : "Confirmar e salvar"}
        </Button>
      </div>

      {modalParcelamentoAberto && (
        <ModalParcelamento
          valorTotal={valorNumerico || 0}
          dataVencimentoInicial={data}
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
