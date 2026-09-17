"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCatalogoCategorias, useCatalogoFormasPagamento } from "@/hooks/useCatalogo";
import { useConta } from "@/hooks/useConta";
import { useObras } from "@/hooks/useObras";
import { useUsuarioAtual } from "@/hooks/useUsuarioAtual";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { StatusContaBadge } from "@/components/ui/StatusContaBadge";
import { HistoricoConta } from "./HistoricoConta";
import { ModalCancelarConta } from "./ModalCancelarConta";
import { SelectComCriacao } from "./SelectComCriacao";
import { formatarData, formatarMoeda, hojeISO } from "@/lib/formatadores";

export function ContaDetalhe({ contaId }: { contaId: string }) {
  const { conta, carregando, darBaixa, cancelar, atualizar } = useConta(contaId);
  const { obras } = useObras();
  const { usuarioOuPadrao } = useUsuarioAtual();
  const categoriasCatalogo = useCatalogoCategorias(conta?.tipo ?? "pagar");
  const formasCatalogo = useCatalogoFormasPagamento();

  const [dataBaixa, setDataBaixa] = useState(hojeISO());
  const [baixando, setBaixando] = useState(false);
  const [modalCancelarAberto, setModalCancelarAberto] = useState(false);

  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [favorecido, setFavorecido] = useState("");
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

  const obra = obras.find((o) => o.id === conta.obraId);
  const rotuloParte = conta.tipo === "pagar" ? "Favorecido" : "Cliente";
  const rotuloAcao = conta.tipo === "pagar" ? "Dar baixa (marcar como paga)" : "Marcar como recebida";
  const podeEditar = conta.status === "em_aberto";

  async function confirmarBaixa() {
    setBaixando(true);
    try {
      await darBaixa({ contaId, dataBaixa, usuario: usuarioOuPadrao });
    } finally {
      setBaixando(false);
    }
  }

  async function confirmarCancelamento(motivo: string) {
    await cancelar({ contaId, motivo: motivo || undefined, usuario: usuarioOuPadrao });
    setModalCancelarAberto(false);
  }

  async function salvarEdicao() {
    setSalvandoEdicao(true);
    try {
      await atualizar(
        {
          valor: Number(valor) || 0,
          descricao: descricao.trim(),
          favorecidoOuCliente: favorecido.trim(),
          dataVencimento,
          categoria: categoria || undefined,
          formaPagamento: formaPagamento || undefined,
          observacao: observacao.trim() || undefined,
          precisaCompletarCadastro: categoria === "" || formaPagamento === "",
        },
        usuarioOuPadrao,
      );
    } finally {
      setSalvandoEdicao(false);
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
        <DetalheLinha
          rotulo="Obra"
          valor={obra ? <Link href={`/obras/${obra.id}`} className="text-primary underline">{obra.nome}</Link> : "—"}
        />
        <DetalheLinha rotulo="Data de lançamento" valor={formatarData(conta.dataLancamento)} />
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
              {conta.precisaCompletarCadastro
                ? "Este lançamento foi criado rapidamente pela câmera. Preencha o que faltar."
                : "Só é possível editar enquanto o lançamento está em aberto."}
            </p>
          </div>
          <Input label="Valor (R$)" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
          <Input
            label={conta.tipo === "pagar" ? "Favorecido/Fornecedor" : "Cliente"}
            value={favorecido}
            onChange={(e) => setFavorecido(e.target.value)}
          />
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
            tituloModal="Nova categoria"
          />
          <SelectComCriacao
            label="Forma de pagamento"
            rotuloVazio="Selecione a forma de pagamento"
            value={formaPagamento}
            onChange={setFormaPagamento}
            opcoes={formasCatalogo.opcoes}
            onCriar={formasCatalogo.criar}
            tituloModal="Nova forma de pagamento"
          />
          <Textarea label="Observação" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          <Button onClick={salvarEdicao} disabled={salvandoEdicao}>
            {salvandoEdicao ? "Salvando…" : "Salvar alterações"}
          </Button>
        </div>
      )}

      {conta.status === "em_aberto" && (
        <Card className="flex flex-col gap-3">
          <Input label="Data" type="date" value={dataBaixa} onChange={(e) => setDataBaixa(e.target.value)} />
          <Button onClick={confirmarBaixa} disabled={baixando}>
            {baixando ? "Salvando…" : rotuloAcao}
          </Button>
          <Button variante="outline" onClick={() => setModalCancelarAberto(true)} disabled={baixando}>
            Cancelar lançamento
          </Button>
        </Card>
      )}

      <HistoricoConta eventos={conta.historico} />

      {modalCancelarAberto && (
        <ModalCancelarConta onFechar={() => setModalCancelarAberto(false)} onConfirmar={confirmarCancelamento} />
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
