"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { AcaoModeracaoAvaliacao, AvaliacaoAdminItem } from "@/types";
import { avaliacoesAdminRepositorio as repo } from "@/services/data";
import { formatarDataBr } from "@/lib/rede/texto";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EstrelasNota } from "@/components/rede/EstrelasNota";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";

const ROTULO_ACAO: Record<AcaoModeracaoAvaliacao, string> = {
  ocultar: "Ocultar",
  remover: "Remover",
  restaurar: "Restaurar",
};

export function AvaliacoesAdmin() {
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");
  const [itens, setItens] = useState<AvaliacaoAdminItem[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<{ id: string; acao: AcaoModeracaoAvaliacao } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [senha, setSenha] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async (termo: string, filtro: string) => {
    setItens(await repo.listar(termo || undefined, filtro || undefined));
  }, []);

  useEffect(() => {
    carregar("", "").catch((e) => setErro(mensagemDeErro(e)));
  }, [carregar]);

  async function confirmar() {
    if (!alvo) return;
    setOcupado(true);
    setErro(null);
    try {
      const resultado = await repo.moderar(alvo.id, alvo.acao, motivo, senha || undefined);
      if (!resultado.ok) {
        setErro(resultado.mensagem);
        return;
      }
      setAlvo(null);
      setMotivo("");
      setSenha("");
      await carregar(busca, status);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          carregar(busca, status).catch((err) => setErro(mensagemDeErro(err)));
        }}
        className="grid gap-2 sm:grid-cols-[1fr_12rem_auto] sm:items-end"
        role="search"
      >
        <Input label="Buscar pelo nome do perfil avaliado" value={busca} onChange={(e) => setBusca(e.target.value)} maxLength={80} />
        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos</option>
          <option value="publicada">Publicadas</option>
          <option value="oculta">Ocultas</option>
          <option value="removida">Removidas</option>
        </Select>
        <Button type="submit" variante="outline" className="h-11">
          Buscar
        </Button>
      </form>

      {erro && (
        <p role="alert" className="rounded-lg border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
          {erro}
        </p>
      )}

      {!itens ? (
        <Card className="h-24 animate-pulse bg-surface-2" aria-busy="true">
          {null}
        </Card>
      ) : itens.length === 0 ? (
        <Card className="text-sm text-muted">Nenhuma avaliação encontrada.</Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {itens.map((a) => (
            <li key={a.id}>
              <Card className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <EstrelasNota nota={a.nota} tamanho="sm" />
                  <Badge tom={a.status === "publicada" ? "success" : a.status === "oculta" ? "warning" : "danger"}>
                    {a.status === "publicada" ? "Publicada" : a.status === "oculta" ? "Oculta" : "Removida"}
                  </Badge>
                  <span className="text-sm text-foreground">
                    {a.avaliadorNome} → <Link href={`/empresas/${a.perfilSlug}`} className="font-medium hover:text-primary">{a.perfilNome}</Link>
                  </span>
                  <span className="text-xs text-muted">{formatarDataBr(a.criadoEm)}</span>
                  {a.relacaoContestada && <Badge tom="warning">Relação contestada pelo avaliado</Badge>}
                </div>
                {a.comentario && <p className="line-clamp-3 whitespace-pre-line text-sm text-foreground/90">{a.comentario}</p>}

                {alvo?.id === a.id ? (
                  <div className="flex flex-col gap-2 border-t border-border pt-3">
                    <Input
                      label={`Motivo para ${ROTULO_ACAO[alvo.acao].toLowerCase()} (fica no log; o avaliador é avisado)`}
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      maxLength={500}
                      autoFocus
                    />
                    <Input
                      type="password"
                      label="Confirme sua senha"
                      autoComplete="current-password"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      maxLength={200}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        tamanho="sm"
                        variante={alvo.acao === "restaurar" ? "primary" : "danger"}
                        disabled={ocupado || motivo.trim().length < 5 || senha.length === 0}
                        onClick={confirmar}
                      >
                        Confirmar: {ROTULO_ACAO[alvo.acao].toLowerCase()}
                      </Button>
                      <Button type="button" tamanho="sm" variante="ghost" onClick={() => setAlvo(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {a.status === "publicada" && (
                      <Button type="button" tamanho="sm" variante="outline" onClick={() => { setAlvo({ id: a.id, acao: "ocultar" }); setMotivo(""); }}>
                        Ocultar
                      </Button>
                    )}
                    {a.status !== "removida" && (
                      <Button type="button" tamanho="sm" variante="outline" onClick={() => { setAlvo({ id: a.id, acao: "remover" }); setMotivo(""); }}>
                        Remover
                      </Button>
                    )}
                    {a.status !== "publicada" && (
                      <Button type="button" tamanho="sm" variante="outline" onClick={() => { setAlvo({ id: a.id, acao: "restaurar" }); setMotivo(""); }}>
                        Restaurar
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
