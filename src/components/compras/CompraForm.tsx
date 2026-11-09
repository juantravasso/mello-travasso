"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CompraDetalhe, DadosExtraidosComprovante, EntradaCompra, SugestaoProduto } from "@/types";
import { useCatalogoCategorias, useCatalogoFormasPagamento } from "@/hooks/useCatalogo";
import { useEstoque } from "@/hooks/useEstoque";
import { useFornecedores } from "@/hooks/useFornecedores";
import { useObras } from "@/hooks/useObras";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { ModalParcelamento, type ParcelaEditavel } from "@/components/contas/ModalParcelamento";
import { SelectComCriacao } from "@/components/contas/SelectComCriacao";
import { SelectFornecedor } from "@/components/contas/SelectFornecedor";
import { SelectProjeto } from "@/components/contas/SelectProjeto";
import { FORMAS_PAGAMENTO_PARCELAVEIS } from "@/lib/categorias";
import { formatarMoeda, hojeISO } from "@/lib/formatadores";
import { formatarNumeroCompra, totaisDaCompra, totalDoItem } from "@/lib/compras";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";
import { comprasRepositorio, estoqueRepositorio } from "@/services/data";
import { IdentificarProdutos } from "./IdentificarProdutos";

interface ItemEditavel {
  descricao: string;
  codigoFornecedor: string;
  ncm: string;
  unidade: string;
  quantidade: string;
  valorUnitario: string;
  desconto: string;
  /** Vazio = o mesmo destino geral da compra. */
  obraId: string;
  produtoId?: string;
}

interface CompraFormProps {
  /** Compra já gravada (rascunho) que está sendo editada. */
  compra?: CompraDetalhe;
  /** Leitura da foto, quando a compra vem do lançamento por foto. */
  dadosExtraidos?: DadosExtraidosComprovante | null;
  comprovanteUrl?: string;
  origem: "foto" | "manual";
  /** Aviso sobre a leitura da foto (carregando/erro) mostrado no topo. */
  avisoLeitura?: string | null;
  onCancelar?: () => void;
}

const numero = (texto: string) => {
  const n = Number(texto.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const texto = (n: number) => (n === 0 ? "" : String(n));

function itemVazio(): ItemEditavel {
  return { descricao: "", codigoFornecedor: "", ncm: "", unidade: "un", quantidade: "1", valorUnitario: "", desconto: "", obraId: "" };
}

/** Lançamento da compra, igual para a foto (já preenchido pela leitura) e para o manual: cabeçalho, itens, valores e pagamento. */
export function CompraForm({ compra, dadosExtraidos, comprovanteUrl = "", origem, avisoLeitura, onCancelar }: CompraFormProps) {
  const router = useRouter();
  const { obras, deposito, criarObra, atualizarObra } = useObras();
  const { fornecedores, criarFornecedor, resolverFornecedor, atualizarFornecedor } = useFornecedores();
  const categoriasCatalogo = useCatalogoCategorias("pagar");
  const formasCatalogo = useCatalogoFormasPagamento();
  const { produtos, recarregar: recarregarProdutos } = useEstoque();

  const [compraId, setCompraId] = useState(compra?.id);
  const [fornecedorId, setFornecedorId] = useState(compra?.fornecedorId ?? "");
  const [fornecedorNome, setFornecedorNome] = useState(compra?.fornecedorNome ?? "");
  const [numeroNf, setNumeroNf] = useState(compra?.numeroNf ?? "");
  const [serie, setSerie] = useState(compra?.serie ?? "");
  const [chaveAcesso, setChaveAcesso] = useState(compra?.chaveAcesso ?? "");
  const [dataEmissao, setDataEmissao] = useState(compra?.dataEmissao ?? "");
  const [dataCompra, setDataCompra] = useState(compra?.dataCompra ?? hojeISO());
  const [obraId, setObraId] = useState(compra?.obraId ?? "");
  const [categoria, setCategoria] = useState(compra?.categoria ?? "");
  const [formaPagamento, setFormaPagamento] = useState(compra?.formaPagamento ?? "");
  const [frete, setFrete] = useState(texto(compra?.frete ?? 0));
  const [seguro, setSeguro] = useState(texto(compra?.seguro ?? 0));
  const [outras, setOutras] = useState(texto(compra?.outrasDespesas ?? 0));
  const [observacao, setObservacao] = useState(compra?.observacao ?? "");
  const [parcelas, setParcelas] = useState<ParcelaEditavel[] | null>(compra && compra.parcelas.length > 1 ? compra.parcelas : null);
  const [itens, setItens] = useState<ItemEditavel[]>(
    compra
      ? compra.itens.map((i) => ({
          descricao: i.descricao,
          codigoFornecedor: i.codigoFornecedor ?? "",
          ncm: i.ncm ?? "",
          unidade: i.unidade ?? "",
          quantidade: String(i.quantidade),
          valorUnitario: String(i.valorUnitario),
          desconto: texto(i.desconto),
          obraId: i.obraId === compra.obraId ? "" : i.obraId,
          produtoId: i.produtoId,
        }))
      : [itemVazio()],
  );
  const [sugestoes, setSugestoes] = useState<(SugestaoProduto | null)[]>([]);
  const [identificando, setIdentificando] = useState(false);
  const [modalProdutos, setModalProdutos] = useState(false);
  const [modalParcelas, setModalParcelas] = useState(false);
  const [ocupado, setOcupado] = useState<"salvar" | "efetivar" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [resolvendoFornecedor, setResolvendoFornecedor] = useState(false);
  const [camposDestacados, setCamposDestacados] = useState<string[]>([]);
  const extraidoRef = useRef<DadosExtraidosComprovante | null>(null);

  useEffect(() => {
    if (!obraId && obras.length > 0 && obras[0]) setObraId(obras[0].id);
  }, [obras, obraId]);

  // Preenche o formulário com o que a IA leu da foto (uma vez por leitura).
  useEffect(() => {
    if (!dadosExtraidos || extraidoRef.current === dadosExtraidos) return;
    extraidoRef.current = dadosExtraidos;
    if (dadosExtraidos.data) {
      setDataEmissao(dadosExtraidos.data);
      setDataCompra(dadosExtraidos.data);
    }
    if (dadosExtraidos.favorecido) setFornecedorNome(dadosExtraidos.favorecido);
    if (dadosExtraidos.itens?.length) {
      setItens(
        dadosExtraidos.itens.map((i) => {
          const quantidade = i.quantidade ?? 1;
          const unitario = i.valorUnitario ?? (i.valorTotal !== undefined && quantidade > 0 ? i.valorTotal / quantidade : 0);
          const bruto = Math.round(quantidade * unitario * 100) / 100;
          // Se a nota já trouxe o total menor que quantidade × unitário, a diferença é o desconto do item.
          const desconto = i.valorTotal !== undefined && bruto > i.valorTotal ? Math.round((bruto - i.valorTotal) * 100) / 100 : 0;
          return {
            ...itemVazio(),
            descricao: i.descricao ?? "",
            unidade: i.unidade ?? "un",
            quantidade: String(quantidade),
            valorUnitario: unitario ? String(unitario) : "",
            desconto: texto(desconto),
          };
        }),
      );
    }
    setCamposDestacados(dadosExtraidos.camposComBaixaConfianca);
    if (dadosExtraidos.favorecido || dadosExtraidos.cnpjFavorecido) {
      setResolvendoFornecedor(true);
      resolverFornecedor(dadosExtraidos.favorecido ?? "", dadosExtraidos.cnpjFavorecido)
        .then((f) => {
          setFornecedorId(f.id);
          setFornecedorNome(f.nome);
        })
        .finally(() => setResolvendoFornecedor(false));
    }
  }, [dadosExtraidos, resolverFornecedor]);

  const opcoesDeDestino = deposito ? [...obras, deposito] : obras;
  const itensCalculados = useMemo(
    () =>
      itens.map((i) => {
        const quantidade = numero(i.quantidade);
        const desconto = numero(i.desconto);
        return { quantidade, desconto, valorUnitario: numero(i.valorUnitario), valorTotal: totalDoItem(quantidade, numero(i.valorUnitario), desconto) };
      }),
    [itens],
  );
  const totais = totaisDaCompra(itensCalculados, numero(frete), numero(seguro), numero(outras));
  // Parcelas escolhidas valem para um total específico: mudou o total, o parcelamento precisa ser refeito.
  useEffect(() => {
    setParcelas((atual) => (atual && Math.round(atual.reduce((a, p) => a + p.valor, 0) * 100) !== Math.round(totais.valorTotal * 100) ? null : atual));
  }, [totais.valorTotal]);
  const semProduto = itens.filter((i) => i.descricao.trim() && !i.produtoId).length;

  function atualizarItem(indice: number, campo: keyof ItemEditavel, valor: string) {
    setItens((atual) =>
      atual.map((item, i) => {
        if (i !== indice) return item;
        // Mudar o que o item é invalida a identificação anterior: ela era de outro produto.
        const mudouIdentidade = campo === "descricao" || campo === "codigoFornecedor";
        return { ...item, [campo]: valor, ...(mudouIdentidade ? { produtoId: undefined } : {}) };
      }),
    );
  }

  const montarEntrada = useCallback((): EntradaCompra => {
    const geral = obraId;
    return {
      origem: compra?.origem ?? origem,
      fornecedorId: fornecedorId || undefined,
      fornecedorNome: fornecedorNome.trim(),
      numeroNf: numeroNf.trim() || undefined,
      serie: serie.trim() || undefined,
      chaveAcesso: chaveAcesso.replace(/\D/g, "") || undefined,
      dataEmissao: dataEmissao || undefined,
      dataCompra,
      obraId: geral,
      categoria: categoria || undefined,
      formaPagamento: formaPagamento || undefined,
      frete: numero(frete),
      seguro: numero(seguro),
      outrasDespesas: numero(outras),
      parcelas: parcelas && parcelas.length > 1 ? parcelas : undefined,
      observacao: observacao.trim() || undefined,
      comprovanteUrl: compra?.comprovanteUrl ?? comprovanteUrl,
      itens: itens
        .filter((i) => i.descricao.trim() !== "")
        .map((i, indice) => {
          const c = itensCalculados[itens.indexOf(i)] ?? itensCalculados[indice]!;
          return {
            descricao: i.descricao.trim(),
            codigoFornecedor: i.codigoFornecedor.trim() || undefined,
            ncm: i.ncm.trim() || undefined,
            unidade: i.unidade.trim() || undefined,
            quantidade: c.quantidade,
            valorUnitario: c.valorUnitario,
            desconto: c.desconto,
            valorTotal: c.valorTotal,
            obraId: i.obraId || geral,
            produtoId: i.produtoId,
          };
        }),
    };
  }, [obraId, compra, origem, fornecedorId, fornecedorNome, numeroNf, serie, chaveAcesso, dataEmissao, dataCompra, categoria, formaPagamento, frete, seguro, outras, parcelas, observacao, comprovanteUrl, itens, itensCalculados]);

  const podeSalvar = fornecedorNome.trim() !== "" && obraId !== "" && itens.some((i) => i.descricao.trim() !== "");

  /** Pede ao servidor a sugestão de produto de cada item e aplica o que ainda não tem escolha. */
  const identificar = useCallback(async () => {
    const lista = itens.map((i) => ({ descricao: i.descricao.trim(), codigoFornecedor: i.codigoFornecedor.trim() || undefined }));
    const r = await comprasRepositorio.sugerirIdentificacao({
      fornecedorId: fornecedorId || undefined,
      fornecedorNome: fornecedorNome.trim() || undefined,
      itens: lista,
    });
    if (!r.ok) throw new Error(r.mensagem);
    setSugestoes(r.dados);
    setItens((atual) => atual.map((item, i) => (item.produtoId ? item : { ...item, produtoId: r.dados[i]?.produtoId })));
  }, [itens, fornecedorId, fornecedorNome]);

  // Na foto, assim que a leitura traz os itens e o fornecedor é resolvido, já tenta identificar sozinho.
  const autoIdentificadoRef = useRef(false);
  useEffect(() => {
    if (origem !== "foto" || compra || autoIdentificadoRef.current) return;
    if (!dadosExtraidos?.itens?.length || resolvendoFornecedor || !itens[0]?.descricao) return;
    autoIdentificadoRef.current = true;
    setIdentificando(true);
    identificar()
      .catch(() => undefined)
      .finally(() => setIdentificando(false));
  }, [origem, compra, dadosExtraidos, resolvendoFornecedor, itens, identificar]);

  async function abrirIdentificacao() {
    setErro(null);
    setModalProdutos(true);
    if (sugestoes.length === 0 && itens.some((i) => !i.produtoId)) {
      try {
        await identificar();
      } catch (e) {
        setErro(mensagemDeErro(e));
      }
    }
  }

  async function gravar(): Promise<string | null> {
    const r = await comprasRepositorio.salvar(montarEntrada(), compraId);
    if (!r.ok) {
      setErro(r.mensagem);
      return null;
    }
    setCompraId(r.dados.id);
    return r.dados.id;
  }

  async function salvar() {
    if (!podeSalvar || ocupado) return;
    setOcupado("salvar");
    setErro(null);
    try {
      const id = await gravar();
      if (id) router.push(`/compras/${id}`);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(null);
    }
  }

  async function efetivar() {
    if (!podeSalvar || ocupado) return;
    setOcupado("efetivar");
    setErro(null);
    try {
      const id = await gravar();
      if (!id) return;
      const r = await comprasRepositorio.efetivar(id);
      if (!r.ok) {
        setErro(r.mensagem);
        // A compra ficou gravada como rascunho; leva para a página dela para continuar de lá.
        router.replace(`/compras/${id}`);
        return;
      }
      router.push("/compras");
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(null);
    }
  }

  const rotuloDestinoGeral = obraId === deposito?.id ? "Depósito" : (obras.find((o) => o.id === obraId)?.nome ?? "—");

  return (
    <div className="flex flex-col gap-4">
      {(comprovanteUrl || compra?.comprovanteUrl) && (
        <div className="flex gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={compra?.comprovanteUrl || comprovanteUrl} alt="Nota fotografada" className="h-24 w-20 flex-shrink-0 rounded-lg border border-border object-cover" />
          <div className="flex flex-1 flex-col justify-center gap-1 text-sm text-muted">
            {avisoLeitura && <p>{avisoLeitura}</p>}
            {dadosExtraidos && !avisoLeitura && (
              <p>Confiança da leitura: {Math.round(dadosExtraidos.confiancaExtracao * 100)}%. Revise os campos destacados e os valores.</p>
            )}
            {identificando && <p>Procurando os produtos no seu estoque…</p>}
          </div>
        </div>
      )}

      {compra && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge tom="warning">Rascunho</Badge>
          <span className="text-sm text-muted">Compra {formatarNumeroCompra(compra.numero)}: nada foi para o estoque nem para as contas ainda.</span>
        </div>
      )}

      <Card className="flex flex-col gap-3">
        <h2 className="font-medium text-foreground">Cabeçalho</h2>
        <SelectFornecedor
          label="Fornecedor"
          fornecedores={fornecedores}
          fornecedorId={fornecedorId}
          nomeSugerido={fornecedorNome}
          onSelecionar={(f) => {
            setFornecedorId(f.id);
            setFornecedorNome(f.nome);
            setSugestoes([]);
          }}
          onCriar={(nome) => criarFornecedor({ nome })}
          onAtualizar={atualizarFornecedor}
        />
        {resolvendoFornecedor && <p className="text-xs text-muted">Identificando fornecedor…</p>}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Input label="Número da NF" value={numeroNf} onChange={(e) => setNumeroNf(e.target.value)} destaque={camposDestacados.includes("numeroNf")} />
          <Input label="Série" value={serie} onChange={(e) => setSerie(e.target.value)} />
          <Input label="Emissão da NF" type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} destaque={camposDestacados.includes("data")} />
          <Input label="Data da compra" type="date" value={dataCompra} onChange={(e) => setDataCompra(e.target.value)} />
        </div>
        <Input
          label="Chave de acesso (44 números)"
          inputMode="numeric"
          value={chaveAcesso}
          onChange={(e) => setChaveAcesso(e.target.value.replace(/\D/g, "").slice(0, 44))}
          placeholder="Opcional"
        />
        <SelectProjeto
          label="Destino padrão dos itens"
          value={obraId}
          onChange={(novo) => {
            setObraId(novo);
          }}
          opcoes={opcoesDeDestino}
          criarObra={criarObra}
          atualizarObra={atualizarObra}
          rotuloVazio="Selecione o projeto"
        />
      </Card>

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium text-foreground">Itens ({itens.length})</h2>
          <div className="flex gap-2">
            <Button variante="outline" tamanho="sm" onClick={() => void abrirIdentificacao()} disabled={!itens.some((i) => i.descricao.trim())}>
              {semProduto > 0 ? `Identificar produtos (${semProduto})` : itens.some((i) => i.descricao.trim()) ? "Rever identificação" : "Identificar produtos"}
            </Button>
            <Button variante="ghost" tamanho="sm" onClick={() => setItens((a) => [...a, itemVazio()])}>
              + Adicionar item
            </Button>
          </div>
        </div>
        {itens.map((item, indice) => (
          <div key={indice} className="grid grid-cols-2 gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0 md:grid-cols-12">
            <Input label="Descrição" className="" value={item.descricao} onChange={(e) => atualizarItem(indice, "descricao", e.target.value)} destaque={camposDestacados.includes("itens")} />
            <Input label="Cód. do fornecedor" value={item.codigoFornecedor} onChange={(e) => atualizarItem(indice, "codigoFornecedor", e.target.value)} />
            <Input label="Qtde" inputMode="decimal" value={item.quantidade} onChange={(e) => atualizarItem(indice, "quantidade", e.target.value)} />
            <Input label="Un." value={item.unidade} onChange={(e) => atualizarItem(indice, "unidade", e.target.value)} />
            <Input label="Valor un. (R$)" inputMode="decimal" value={item.valorUnitario} onChange={(e) => atualizarItem(indice, "valorUnitario", e.target.value)} />
            <Input label="Desconto (R$)" inputMode="decimal" value={item.desconto} onChange={(e) => atualizarItem(indice, "desconto", e.target.value)} />
            <div className="flex flex-col justify-end gap-1 text-sm">
              <span className="font-medium text-foreground">Total</span>
              <span className="flex h-11 items-center font-semibold tabular-nums">{formatarMoeda(itensCalculados[indice]?.valorTotal ?? 0)}</span>
            </div>
            <SelectProjeto
              label="Vai para"
              value={item.obraId}
              onChange={(novo) => atualizarItem(indice, "obraId", novo)}
              opcoes={opcoesDeDestino}
              criarObra={criarObra}
              atualizarObra={atualizarObra}
              vazioEscolhivel
              rotuloVazio={`Igual ao padrão (${rotuloDestinoGeral})`}
            />
            <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 md:col-span-12">
              <span className="text-xs">
                {item.descricao.trim() === "" ? null : item.produtoId ? (
                  <Badge tom="success">{`Produto: ${produtos.find((p) => p.id === item.produtoId)?.nome ?? "identificado"}`}</Badge>
                ) : (
                  <Badge tom="danger">Sem produto do sistema</Badge>
                )}
              </span>
              {itens.length > 1 && (
                <Button variante="ghost" tamanho="sm" onClick={() => setItens((a) => a.filter((_, i) => i !== indice))}>
                  Remover item
                </Button>
              )}
            </div>
          </div>
        ))}
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="font-medium text-foreground">Valores e pagamento</h2>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Frete (R$)" inputMode="decimal" value={frete} onChange={(e) => setFrete(e.target.value)} />
          <Input label="Seguro (R$)" inputMode="decimal" value={seguro} onChange={(e) => setSeguro(e.target.value)} />
          <Input label="Outras despesas (R$)" inputMode="decimal" value={outras} onChange={(e) => setOutras(e.target.value)} />
        </div>
        <dl className="grid grid-cols-2 gap-2 rounded-lg bg-surface-2 p-3 text-sm tabular-nums md:grid-cols-4">
          <div>
            <dt className="text-muted">Produtos</dt>
            <dd className="font-medium">{formatarMoeda(totais.valorProdutos)}</dd>
          </div>
          <div>
            <dt className="text-muted">Descontos</dt>
            <dd className="font-medium">{formatarMoeda(totais.descontoTotal)}</dd>
          </div>
          <div>
            <dt className="text-muted">Itens</dt>
            <dd className="font-medium">{itens.filter((i) => i.descricao.trim()).length}</dd>
          </div>
          <div>
            <dt className="text-muted">Total da NF</dt>
            <dd className="text-base font-semibold">{formatarMoeda(totais.valorTotal)}</dd>
          </div>
        </dl>
        <SelectComCriacao
          label="Forma de pagamento (opcional)"
          rotuloVazio="Completar depois"
          opcional
          value={formaPagamento}
          onChange={(v) => {
            setFormaPagamento(v);
            if (!FORMAS_PAGAMENTO_PARCELAVEIS.includes(v)) setParcelas(null);
          }}
          opcoes={formasCatalogo.opcoes}
          onCriar={formasCatalogo.criar}
          onRenomear={formasCatalogo.renomear}
          tituloModal="Nova forma de pagamento"
        />
        {FORMAS_PAGAMENTO_PARCELAVEIS.includes(formaPagamento) && (
          <Button variante="outline" tamanho="sm" onClick={() => setModalParcelas(true)} disabled={totais.valorTotal <= 0}>
            {parcelas ? `Parcelado em ${parcelas.length}x` : "Parcelar pagamento"}
          </Button>
        )}
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
        <Textarea label="Observação (opcional)" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
      </Card>

      {erro && (
        <p role="alert" className="text-sm text-danger">
          {erro}
        </p>
      )}
      {semProduto > 0 && (
        <p className="text-sm text-muted">
          Faltam {semProduto} item(ns) para identificar. Dá para salvar como rascunho, mas só efetiva depois de identificar todos.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button variante="outline" onClick={onCancelar ?? (() => router.push("/compras"))} disabled={ocupado !== null}>
          Cancelar
        </Button>
        <Button variante="outline" className="flex-1" onClick={() => void salvar()} disabled={!podeSalvar || ocupado !== null}>
          {ocupado === "salvar" ? "Salvando…" : "Salvar rascunho"}
        </Button>
        <Button className="flex-1" onClick={() => void efetivar()} disabled={!podeSalvar || semProduto > 0 || totais.valorTotal <= 0 || ocupado !== null}>
          {ocupado === "efetivar" ? "Efetivando…" : "Efetivar compra"}
        </Button>
      </div>

      {modalProdutos && (
        <IdentificarProdutos
          itens={itens.map((i, indice) => ({
            descricao: i.descricao,
            codigoFornecedor: i.codigoFornecedor || undefined,
            unidade: i.unidade || undefined,
            quantidade: itensCalculados[indice]?.quantidade ?? 0,
            produtoId: i.produtoId,
          }))}
          produtos={produtos}
          sugestoes={sugestoes}
          onIdentificar={identificar}
          onCriarProduto={async (nome, unidade) => {
            const novo = await estoqueRepositorio.criarProduto({ nome: nome.trim(), unidade });
            await recarregarProdutos();
            return novo.id;
          }}
          onConfirmar={(escolhas) => {
            setItens((atual) => atual.map((item, i) => ({ ...item, produtoId: escolhas[i] })));
            setModalProdutos(false);
          }}
          onFechar={() => setModalProdutos(false)}
        />
      )}
      {modalParcelas && (
        <ModalParcelamento
          valorTotal={totais.valorTotal}
          dataVencimentoInicial={dataCompra}
          parcelasIniciais={parcelas ?? undefined}
          onFechar={() => setModalParcelas(false)}
          onConfirmar={(novas) => {
            setParcelas(novas);
            setModalParcelas(false);
          }}
        />
      )}
    </div>
  );
}
