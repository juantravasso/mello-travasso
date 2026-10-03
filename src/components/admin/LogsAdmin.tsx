"use client";

import { useEffect, useState } from "react";
import type { PaginaLogsAdmin } from "@/types";
import { logsAdminRepositorio as repo } from "@/services/data";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

export function LogsAdmin() {
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<PaginaLogsAdmin | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    repo
      .listar(pagina)
      .then((r) => {
        if (!cancelado) setDados(r);
      })
      .catch(() => {
        if (!cancelado) setErro("Não foi possível carregar agora. Tente de novo.");
      });
    return () => {
      cancelado = true;
    };
  }, [pagina]);

  if (erro) return <Card role="alert" className="border-danger bg-danger-bg text-sm text-danger">{erro}</Card>;
  if (!dados) return <Card className="h-40 animate-pulse bg-surface-2" aria-busy="true">{null}</Card>;
  if (dados.itens.length === 0) return <Card className="text-sm text-muted">Nenhuma ação registrada ainda.</Card>;

  return (
    <div className="flex max-w-4xl flex-col gap-3">
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="p-3 font-medium">Quando</th>
              <th className="p-3 font-medium">Quem</th>
              <th className="p-3 font-medium">Ação</th>
              <th className="p-3 font-medium">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {dados.itens.map((l) => (
              <tr key={l.id} className="border-b border-border align-top last:border-0">
                <td className="whitespace-nowrap p-3 text-muted tabular-nums">{formatarDataHora(l.criadoEm)}</td>
                <td className="p-3 text-foreground">{l.adminNome}</td>
                <td className="p-3">
                  <span className="font-medium text-foreground">{l.acao}</span>
                  <span className="block text-xs text-muted">{l.alvoTipo}</span>
                </td>
                <td className="max-w-xs break-words p-3 font-mono text-xs text-muted">{l.detalhes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {dados.totalPaginas > 1 && (
        <nav aria-label="Páginas do log" className="flex items-center justify-between gap-3 text-sm">
          <Button type="button" tamanho="sm" variante="outline" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
            ← Mais recentes
          </Button>
          <span className="text-muted tabular-nums">
            Página {dados.pagina} de {dados.totalPaginas}
          </span>
          <Button type="button" tamanho="sm" variante="outline" disabled={pagina >= dados.totalPaginas} onClick={() => setPagina((p) => p + 1)}>
            Mais antigas →
          </Button>
        </nav>
      )}
    </div>
  );
}
