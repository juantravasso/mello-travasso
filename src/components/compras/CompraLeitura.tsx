"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CompraDetalhe } from "@/types";
import { useEstoque } from "@/hooks/useEstoque";
import { useObras } from "@/hooks/useObras";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { formatarMoeda, formatarData } from "@/lib/formatadores";
import { formatarNumeroCompra } from "@/lib/compras";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";
import { comprasRepositorio } from "@/services/data";

/** Compra já efetivada ou cancelada: só leitura, com o cancelamento (que estorna o estoque e cancela as contas em aberto). */
export function CompraLeitura({ compra }: { compra: CompraDetalhe }) {
  const router = useRouter();
  const { produtos } = useEstoque();
  const { locais } = useObras();
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const nomeProduto = (id?: string) => produtos.find((p) => p.id === id)?.nome;
  const nomeLocal = (id: string) => locais.find((l) => l.id === id)?.nome ?? "—";
  const efetivada = compra.status === "efetivada";

  async function cancelar() {
    setOcupado(true);
    setErro(null);
    try {
      const r = await comprasRepositorio.cancelar({ id: compra.id, motivo });
      if (!r.ok) {
        setErro(r.mensagem);
        return;
      }
      // O aviso do estoque (parte já consumida) precisa chegar à pessoa; vai na própria lista.
      router.push(r.dados.avisoEstoque ? `/compras?aviso=${encodeURIComponent(r.dados.avisoEstoque)}` : "/compras");
      router.refresh();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tom={efetivada ? "success" : "neutral"}>{efetivada ? "Efetivada" : "Cancelada"}</Badge>
        <span className="text-sm text-muted">Compra {formatarNumeroCompra(compra.numero)}</span>
        {compra.status === "cancelada" && compra.motivoCancelamento && (
          <span className="text-sm text-muted">· Motivo: {compra.motivoCancelamento}</span>
        )}
      </div>

      <Card className="flex flex-col gap-2 text-sm">
        <h2 className="font-medium text-foreground">Cabeçalho</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-4">
          <Dado rotulo="Fornecedor" valor={compra.fornecedorNome} />
          <Dado rotulo="Nota fiscal" valor={[compra.numeroNf, compra.serie ? `série ${compra.serie}` : null].filter(Boolean).join(" · ") || "—"} />
          <Dado rotulo="Emissão" valor={compra.dataEmissao ? formatarData(compra.dataEmissao) : "—"} />
          <Dado rotulo="Data da compra" valor={formatarData(compra.dataCompra)} />
          <Dado rotulo="Forma de pagamento" valor={compra.formaPagamento ?? "—"} />
          <Dado rotulo="Categoria" valor={compra.categoria ?? "—"} />
          <Dado rotulo="Origem" valor={compra.origem === "foto" ? "Foto" : "Manual"} />
          <Dado rotulo="Parcelas" valor={compra.parcelas.length > 1 ? `${compra.parcelas.length}x` : "À vista"} />
        </dl>
        {compra.chaveAcesso && <p className="break-all text-xs text-muted tabular-nums">Chave de acesso: {compra.chaveAcesso}</p>}
        {compra.observacao && <p className="text-muted">{compra.observacao}</p>}
      </Card>

      <Card className="flex flex-col gap-2">
        <h2 className="font-medium text-foreground">Itens ({compra.itens.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="py-2 pr-3 font-medium">Descrição</th>
                <th className="py-2 pr-3 font-medium">Produto do sistema</th>
                <th className="py-2 pr-3 text-right font-medium">Qtde</th>
                <th className="py-2 pr-3 text-right font-medium">Valor un.</th>
                <th className="py-2 pr-3 text-right font-medium">Desc.</th>
                <th className="py-2 pr-3 text-right font-medium">Total</th>
                <th className="py-2 font-medium">Destino</th>
              </tr>
            </thead>
            <tbody>
              {compra.itens.map((i, indice) => (
                <tr key={i.id ?? indice} className="border-b border-border last:border-0">
                  <td className="py-2 pr-3">
                    {i.descricao}
                    {i.codigoFornecedor && <span className="block text-xs text-muted">Cód. {i.codigoFornecedor}</span>}
                  </td>
                  <td className="py-2 pr-3 text-muted">{nomeProduto(i.produtoId) ?? "—"}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {i.quantidade} {i.unidade ?? ""}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatarMoeda(i.valorUnitario)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{i.desconto ? formatarMoeda(i.desconto) : "—"}</td>
                  <td className="py-2 pr-3 text-right font-medium tabular-nums">{formatarMoeda(i.valorTotal)}</td>
                  <td className="py-2">{nomeLocal(i.obraId)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-2 rounded-lg bg-surface-2 p-3 text-sm tabular-nums md:grid-cols-5">
          <Dado rotulo="Produtos" valor={formatarMoeda(compra.valorProdutos)} />
          <Dado rotulo="Frete" valor={formatarMoeda(compra.frete)} />
          <Dado rotulo="Seguro" valor={formatarMoeda(compra.seguro)} />
          <Dado rotulo="Outras despesas" valor={formatarMoeda(compra.outrasDespesas)} />
          <Dado rotulo="Total da NF" valor={formatarMoeda(compra.valorTotal)} forte />
        </dl>
      </Card>

      {compra.parcelas.length > 1 && (
        <Card className="flex flex-col gap-2 text-sm">
          <h2 className="font-medium text-foreground">Vencimentos</h2>
          <ul className="flex flex-col gap-1 tabular-nums">
            {compra.parcelas.map((p, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="text-muted">
                  {i + 1}/{compra.parcelas.length} · {formatarData(p.dataVencimento)}
                </span>
                <span className="font-medium">{formatarMoeda(p.valor)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}

      <div className="flex flex-wrap gap-3">
        <Link href="/compras">
          <Button variante="outline">Voltar</Button>
        </Link>
        {efetivada && (
          <>
            <Link href="/contas-a-pagar">
              <Button variante="outline">Ver contas a pagar</Button>
            </Link>
            <Button variante="danger" onClick={() => setCancelando(true)}>
              Cancelar compra
            </Button>
          </>
        )}
      </div>

      {cancelando && (
        <Modal titulo="Cancelar compra" onFechar={() => setCancelando(false)}>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">
              As contas em aberto desta compra serão canceladas e a entrada no estoque será estornada. Se alguma parcela já foi paga, desfaça a baixa antes.
            </p>
            <Textarea label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
            <div className="flex gap-2">
              <Button variante="outline" className="flex-1" onClick={() => setCancelando(false)} disabled={ocupado}>
                Voltar
              </Button>
              <Button variante="danger" className="flex-1" onClick={() => void cancelar()} disabled={ocupado || motivo.trim().length < 3}>
                {ocupado ? "Cancelando…" : "Cancelar compra"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Dado({ rotulo, valor, forte }: { rotulo: string; valor: string; forte?: boolean }) {
  return (
    <div>
      <dt className="text-muted">{rotulo}</dt>
      <dd className={forte ? "text-base font-semibold" : "font-medium"}>{valor}</dd>
    </div>
  );
}
