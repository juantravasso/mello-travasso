"use client";

import { useState } from "react";
import Link from "next/link";
import type { CategoriaConta, FormaPagamento } from "@/types";
import { useConta } from "@/hooks/useConta";
import { useObras } from "@/hooks/useObras";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { StatusContaBadge } from "@/components/ui/StatusContaBadge";
import {
  categoriasPagar,
  categoriasReceber,
  formasPagamento,
  rotulosCategoriaPagar,
  rotulosCategoriaReceber,
  rotulosFormaPagamento,
} from "@/lib/categorias";
import { formatarData, formatarMoeda, hojeISO } from "@/lib/formatadores";

export function ContaDetalhe({ contaId }: { contaId: string }) {
  const { conta, carregando, darBaixa, atualizar } = useConta(contaId);
  const { obras } = useObras();
  const [dataBaixa, setDataBaixa] = useState(hojeISO());
  const [baixando, setBaixando] = useState(false);

  if (carregando) return <p className="text-sm text-muted">Carregando…</p>;
  if (!conta) return <p className="text-sm text-danger">Conta não encontrada.</p>;

  const obra = obras.find((o) => o.id === conta.obraId);
  const rotuloParte = conta.tipo === "pagar" ? "Favorecido" : "Cliente";
  const rotuloAcao = conta.tipo === "pagar" ? "Dar baixa (marcar como paga)" : "Marcar como recebida";
  const rotulosCategoriaDoTipo = conta.tipo === "pagar" ? rotulosCategoriaPagar : rotulosCategoriaReceber;

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
        {conta.categoria && (
          <DetalheLinha
            rotulo="Categoria"
            valor={rotulosCategoriaDoTipo[conta.categoria as keyof typeof rotulosCategoriaDoTipo] ?? conta.categoria}
          />
        )}
        {conta.formaPagamento && (
          <DetalheLinha rotulo="Forma de pagamento" valor={rotulosFormaPagamento[conta.formaPagamento]} />
        )}
        {conta.observacao && <DetalheLinha rotulo="Observação" valor={conta.observacao} />}
        <DetalheLinha
          rotulo="Obra"
          valor={obra ? <Link href={`/obras/${obra.id}`} className="text-primary underline">{obra.nome}</Link> : "—"}
        />
        <DetalheLinha rotulo="Data de lançamento" valor={formatarData(conta.dataLancamento)} />
        <DetalheLinha rotulo="Data de vencimento" valor={formatarData(conta.dataVencimento)} />
        {conta.dataBaixa && <DetalheLinha rotulo="Data de baixa" valor={formatarData(conta.dataBaixa)} />}
        {conta.origemNotaFiscal && <DetalheLinha rotulo="Origem" valor="Nota fiscal" />}
      </Card>

      {conta.precisaCompletarCadastro && (
        <CompletarCadastro
          categoriaAtual={conta.categoria}
          formaPagamentoAtual={conta.formaPagamento}
          observacaoAtual={conta.observacao}
          categorias={conta.tipo === "pagar" ? categoriasPagar : categoriasReceber}
          rotulosCategoria={rotulosCategoriaDoTipo}
          onSalvar={(dados) => atualizar({ ...dados, precisaCompletarCadastro: false })}
        />
      )}

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

interface CompletarCadastroProps {
  categoriaAtual?: CategoriaConta;
  formaPagamentoAtual?: FormaPagamento;
  observacaoAtual?: string;
  categorias: readonly CategoriaConta[];
  rotulosCategoria: Record<string, string>;
  onSalvar: (dados: { categoria?: CategoriaConta; formaPagamento?: FormaPagamento; observacao?: string }) => Promise<unknown>;
}

function CompletarCadastro({
  categoriaAtual,
  formaPagamentoAtual,
  observacaoAtual,
  categorias,
  rotulosCategoria,
  onSalvar,
}: CompletarCadastroProps) {
  const [categoria, setCategoria] = useState<CategoriaConta | "">(categoriaAtual ?? "");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento | "">(formaPagamentoAtual ?? "");
  const [observacao, setObservacao] = useState(observacaoAtual ?? "");
  const [salvando, setSalvando] = useState(false);

  const valido = categoria !== "" && formaPagamento !== "";

  async function salvar() {
    if (!valido) return;
    setSalvando(true);
    try {
      await onSalvar({
        categoria: categoria || undefined,
        formaPagamento: formaPagamento || undefined,
        observacao: observacao.trim() || undefined,
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-info/40 bg-info-bg p-4">
      <div>
        <p className="font-medium text-foreground">Completar cadastro</p>
        <p className="text-sm text-muted">
          Este lançamento foi criado rapidamente pela câmera. Preencha categoria e forma de pagamento para
          finalizar o cadastro.
        </p>
      </div>
      <Select label="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaConta)}>
        <option value="">Selecione a categoria</option>
        {categorias.map((c) => (
          <option key={c} value={c}>
            {rotulosCategoria[c]}
          </option>
        ))}
      </Select>
      <Select
        label="Forma de pagamento"
        value={formaPagamento}
        onChange={(e) => setFormaPagamento(e.target.value as FormaPagamento)}
      >
        <option value="">Selecione a forma de pagamento</option>
        {formasPagamento.map((f) => (
          <option key={f} value={f}>
            {rotulosFormaPagamento[f]}
          </option>
        ))}
      </Select>
      <Textarea label="Observação (opcional)" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
      <Button onClick={salvar} disabled={!valido || salvando}>
        {salvando ? "Salvando…" : "Salvar e concluir cadastro"}
      </Button>
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
