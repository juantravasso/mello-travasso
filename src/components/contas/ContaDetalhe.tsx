"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCatalogoCategorias, useCatalogoFormasPagamento } from "@/hooks/useCatalogo";
import { useConta } from "@/hooks/useConta";
import { useFornecedores } from "@/hooks/useFornecedores";
import { useObras } from "@/hooks/useObras";
import { useStatusPlano } from "@/components/layout/StatusPlanoContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { StatusContaBadge } from "@/components/ui/StatusContaBadge";
import { HistoricoConta } from "./HistoricoConta";
import { ModalCancelarConta } from "./ModalCancelarConta";
import { ModalConfirmarBaixa } from "./ModalConfirmarBaixa";
import { SelectComCriacao } from "./SelectComCriacao";
import { SelectFornecedor } from "./SelectFornecedor";
import { SelectProjeto } from "./SelectProjeto";
import { lancadoPor } from "@/lib/autoria";
import { formatarData, formatarMoeda, hojeISO } from "@/lib/formatadores";

export function ContaDetalhe({ contaId }: { contaId: string }) {
  const { conta, carregando, darBaixa, cancelar, atualizar } = useConta(contaId);
  const { obras, locais, criarObra, atualizarObra } = useObras();
  const { fornecedores, criarFornecedor, atualizarFornecedor } = useFornecedores();
  const { somenteLeitura } = useStatusPlano();
  const categoriasCatalogo = useCatalogoCategorias(conta?.tipo ?? "pagar");
  const formasCatalogo = useCatalogoFormasPagamento();

  const [dataBaixa, setDataBaixa] = useState(hojeISO());
  const [baixando, setBaixando] = useState(false);
  const [modalCancelarAberto, setModalCancelarAberto] = useState(false);
  const [modalConfirmarBaixaAberto, setModalConfirmarBaixaAberto] = useState(false);
  const [avisoEstoque, setAvisoEstoque] = useState<string | null>(null);

  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [favorecido, setFavorecido] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [obraId, setObraId] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [categoria, setCategoria] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  useEffect(() => {
    if (!conta || conta.status !== "em_aberto") return;
    setValor(String(conta.valor));
    setDescricao(conta.descricao);
    setFavorecido(conta.favorecidoOuCliente);
    setFornecedorId(conta.fornecedorId ?? "");
    setObraId(conta.obraId);
    setDataVencimento(conta.dataVencimento);
    setCategoria(conta.categoria ?? "");
    setFormaPagamento(conta.formaPagamento ?? "");
    setObservacao(conta.observacao ?? "");
    // Só preenche o formulário quando a conta muda de identidade (carregou pela
    // 1ª vez) — reflete só o que foi salvo depois, sem sobrescrever a edição em curso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conta?.id]);

  if (carregando) return <p className="text-sm text-muted">Carregando…</p>;
  if (!conta) return <p className="text-sm text-danger">Conta não encontrada.</p>;

  const obra = locais.find((o) => o.id === conta.obraId);
  const dividida = (conta.rateios?.length ?? 0) > 0;
  // Contas a pagar podem ser do Depósito; a receber, só de projeto.
  const opcoesDeDestino = conta.tipo === "pagar" ? locais : obras;
  const rotuloParte = conta.tipo === "pagar" ? "Favorecido" : "Cliente";
  const rotuloAcao = conta.tipo === "pagar" ? "Dar baixa (marcar como paga)" : "Marcar como recebida";
  const podeEditar = conta.status === "em_aberto";

  async function confirmarBaixa() {
    setBaixando(true);
    try {
      await darBaixa({ contaId, dataBaixa });
    } finally {
      setBaixando(false);
    }
  }

  async function confirmarCancelamento(motivo: string) {
    const resultado = await cancelar({ contaId, motivo: motivo || undefined });
    setModalCancelarAberto(false);
    setAvisoEstoque(resultado.avisoEstoque ?? null);
  }

  async function salvarEdicao() {
    const estavaIncompleta = conta?.precisaCompletarCadastro ?? false;
    setSalvandoEdicao(true);
    try {
      const atualizada = await atualizar(
        {
          valor: Number(valor) || 0,
          descricao: descricao.trim(),
          favorecidoOuCliente: favorecido.trim(),
          fornecedorId: conta?.tipo === "pagar" ? fornecedorId || undefined : undefined,
          obraId,
          dataVencimento,
          categoria: categoria || undefined,
          formaPagamento: formaPagamento || undefined,
          observacao: observacao.trim() || undefined,
          precisaCompletarCadastro: categoria === "" || formaPagamento === "",
        },
      );
      // Só faz sentido perguntar "já foi paga?" quando a conta estava
      // marcada como incompleta (veio da câmera) e continua em aberto —
      // uma edição comum num lançamento já completo não deve interromper
      // com essa pergunta.
      // Se a forma de pagamento dá baixa sozinha (dinheiro, PIX…), a conta já saiu paga: não há o que perguntar.
      if (estavaIncompleta && atualizada.status === "em_aberto") setModalConfirmarBaixaAberto(true);
    } finally {
      setSalvandoEdicao(false);
    }
  }

  async function confirmarBaixaAoCompletar(data: string) {
    await darBaixa({ contaId, dataBaixa: data });
    setModalConfirmarBaixaAberto(false);
  }

  return (
    <div className="flex flex-col gap-4">
      {avisoEstoque && (
        <div className="rounded-xl border border-warning bg-warning-bg p-4 text-sm text-warning">{avisoEstoque}</div>
      )}
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
        {conta.parcela && (
          <DetalheLinha rotulo="Parcela" valor={`${conta.parcela.numero}/${conta.parcela.totalParcelas}`} />
        )}
        <DetalheLinha rotulo={rotuloParte} valor={conta.favorecidoOuCliente} />
        <DetalheLinha rotulo="Descrição" valor={conta.descricao} />
        {conta.categoria && (
          <DetalheLinha rotulo="Categoria" valor={categoriasCatalogo.rotuloDe(conta.categoria)} />
        )}
        {conta.formaPagamento && (
          <DetalheLinha rotulo="Forma de pagamento" valor={formasCatalogo.rotuloDe(conta.formaPagamento)} />
        )}
        {conta.observacao && <DetalheLinha rotulo="Observação" valor={conta.observacao} />}
        {dividida ? (
          conta.rateios?.map((r) => {
            const destino = locais.find((o) => o.id === r.obraId);
            return (
              <DetalheLinha
                key={r.obraId}
                rotulo={destino?.ehDeposito ? "Parte do Depósito" : "Parte do projeto"}
                valor={
                  <>
                    {destino ? <LinkDoLocal local={destino} /> : "—"} · {formatarMoeda(r.valor)}
                  </>
                }
              />
            );
          })
        ) : (
          <DetalheLinha rotulo={obra?.ehDeposito ? "Destino" : "Projeto"} valor={obra ? <LinkDoLocal local={obra} /> : "—"} />
        )}
        <DetalheLinha rotulo="Data de lançamento" valor={formatarData(conta.dataLancamento)} />
        {lancadoPor(conta) && <DetalheLinha rotulo="Lançado por" valor={lancadoPor(conta) as string} />}
        <DetalheLinha rotulo="Data de vencimento" valor={formatarData(conta.dataVencimento)} />
        {conta.dataBaixa && <DetalheLinha rotulo="Data de baixa" valor={formatarData(conta.dataBaixa)} />}
        {conta.motivoCancelamento && <DetalheLinha rotulo="Motivo do cancelamento" valor={conta.motivoCancelamento} />}
        {conta.origemNotaFiscal && <DetalheLinha rotulo="Origem" valor="Nota fiscal" />}
      </Card>

      {podeEditar && (
        <div
          className={
            conta.precisaCompletarCadastro
              ? "flex flex-col gap-3 rounded-xl border border-info/40 bg-info-bg p-4"
              : "flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
          }
        >
          <div>
            <p className="font-medium text-foreground">
              {conta.precisaCompletarCadastro ? "Completar cadastro" : "Editar lançamento"}
            </p>
            <p className="text-sm text-muted">
              {somenteLeitura
                ? "Somente leitura: seu teste ou assinatura não está ativo. Os dados continuam disponíveis para consulta."
                : conta.precisaCompletarCadastro
                  ? "Este lançamento foi criado rapidamente pela câmera. Preencha o que faltar."
                  : "Só é possível editar enquanto o lançamento está em aberto."}
            </p>
          </div>
          {dividida && (
            <p className="text-sm text-muted">
              Esta nota está dividida entre mais de um destino, então o valor e o projeto não se editam aqui. Para mudar,
              cancele e lance de novo.
            </p>
          )}
          <Input label="Valor (R$)" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} disabled={dividida} />
          <SelectProjeto
            label="Projeto"
            value={obraId}
            onChange={setObraId}
            opcoes={opcoesDeDestino}
            criarObra={criarObra}
            atualizarObra={atualizarObra}
            disabled={dividida}
            rotuloVazio="Selecione o projeto"
          />
          {conta.tipo === "pagar" ? (
            <SelectFornecedor
              label="Favorecido/Fornecedor"
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
          ) : (
            <Input label="Cliente" value={favorecido} onChange={(e) => setFavorecido(e.target.value)} />
          )}
          <Textarea label="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          <Input
            label="Data de vencimento"
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
            onChange={setFormaPagamento}
            opcoes={formasCatalogo.opcoes}
            onCriar={formasCatalogo.criar}
            onRenomear={formasCatalogo.renomear}
            tituloModal="Nova forma de pagamento"
          />
          <Textarea label="Observação" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          <Button onClick={salvarEdicao} disabled={salvandoEdicao || somenteLeitura}>
            {salvandoEdicao ? "Salvando…" : "Salvar alterações"}
          </Button>
        </div>
      )}

      {conta.status === "em_aberto" && (
        <Card className="flex flex-col gap-3">
          {somenteLeitura && (
            <p className="text-sm text-muted">Somente leitura: seu teste ou assinatura não está ativo. Os dados continuam disponíveis para consulta.</p>
          )}
          <Input label="Data" type="date" value={dataBaixa} onChange={(e) => setDataBaixa(e.target.value)} />
          <Button onClick={confirmarBaixa} disabled={baixando || somenteLeitura}>
            {baixando ? "Salvando…" : rotuloAcao}
          </Button>
          <Button variante="outline" onClick={() => setModalCancelarAberto(true)} disabled={baixando || somenteLeitura}>
            Cancelar lançamento
          </Button>
        </Card>
      )}

      <HistoricoConta eventos={conta.historico} />

      {modalCancelarAberto && (
        <ModalCancelarConta onFechar={() => setModalCancelarAberto(false)} onConfirmar={confirmarCancelamento} />
      )}

      {modalConfirmarBaixaAberto && (
        <ModalConfirmarBaixa
          tipo={conta.tipo}
          onFechar={() => setModalConfirmarBaixaAberto(false)}
          onConfirmar={confirmarBaixaAoCompletar}
        />
      )}
    </div>
  );
}

function LinkDoLocal({ local }: { local: { id: string; nome: string; ehDeposito?: boolean } }) {
  return (
    <Link href={local.ehDeposito ? "/estoque/deposito" : `/obras/${local.id}`} className="text-primary underline">
      {local.nome}
    </Link>
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
