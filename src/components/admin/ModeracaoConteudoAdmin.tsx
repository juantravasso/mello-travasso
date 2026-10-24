"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { RecomendacaoAdminItem, ResultadoAction, TrabalhoAdminItem } from "@/types";
import { listarRecomendacoesAdmin, listarTrabalhosAdmin, removerRecomendacaoAdmin, removerTrabalhoAdmin } from "@/services/data/server/conteudoAdminActions";
import { formatarDataBr } from "@/lib/rede/texto";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PainelConfirmacao } from "./PainelConfirmacao";

interface PropsLista<T extends { id: string }> {
  rotuloBusca: string;
  vazio: string;
  rotuloMotivo: string;
  rotuloBotao: string;
  listar: (busca: string) => Promise<T[]>;
  remover: (id: string, motivo: string, senha: string) => Promise<ResultadoAction<null>>;
  linha: (item: T) => ReactNode;
}

/** Lista com busca e remoção com motivo e senha. As duas telas (recomendações e portfólio) só mudam a linha. */
function ListaModeracao<T extends { id: string }>({ rotuloBusca, vazio, rotuloMotivo, rotuloBotao, listar, remover, linha }: PropsLista<T>) {
  const [busca, setBusca] = useState("");
  const [itens, setItens] = useState<T[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(
    async (termo: string) => {
      setItens(await listar(termo));
    },
    [listar],
  );

  useEffect(() => {
    carregar("").catch((e) => setErro(mensagemDeErro(e)));
  }, [carregar]);

  async function confirmar(id: string, motivo: string, senha: string) {
    setOcupado(true);
    setErro(null);
    try {
      const r = await remover(id, motivo, senha);
      if (!r.ok) {
        setErro(r.mensagem);
        return;
      }
      setAlvo(null);
      await carregar(busca);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          carregar(busca).catch((err) => setErro(mensagemDeErro(err)));
        }}
        className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end"
      >
        <Input label={rotuloBusca} value={busca} onChange={(e) => setBusca(e.target.value)} maxLength={80} />
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
        <Card className="text-sm text-muted">{vazio}</Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {itens.map((item) => (
            <li key={item.id}>
              <Card className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">{linha(item)}</div>
                  {alvo !== item.id && (
                    <Button type="button" tamanho="sm" variante="danger" disabled={ocupado} onClick={() => { setErro(null); setAlvo(item.id); }}>
                      {rotuloBotao}
                    </Button>
                  )}
                </div>
                {alvo === item.id && (
                  <PainelConfirmacao
                    rotuloMotivo={rotuloMotivo}
                    rotuloBotao={rotuloBotao}
                    perigo
                    ocupado={ocupado}
                    aoConfirmar={(motivo, senha) => confirmar(item.id, motivo, senha)}
                    aoCancelar={() => setAlvo(null)}
                  />
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RecomendacoesAdmin() {
  return (
    <ListaModeracao<RecomendacaoAdminItem>
      rotuloBusca="Buscar pelo nome do perfil recomendado"
      vazio="Nenhuma recomendação encontrada."
      rotuloMotivo="Motivo da remoção (fica no registro de ações)"
      rotuloBotao="Remover recomendação"
      listar={listarRecomendacoesAdmin}
      remover={removerRecomendacaoAdmin}
      linha={(r) => (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-foreground">
            {r.recomendadoPorNome} recomendou{" "}
            <Link href={`/empresas/${r.perfilSlug}`} className="font-medium hover:text-primary">
              {r.perfilNome}
            </Link>
          </p>
          <p className="text-xs text-muted">{formatarDataBr(r.criadoEm)}</p>
        </div>
      )}
    />
  );
}

export function PortfolioAdmin() {
  return (
    <ListaModeracao<TrabalhoAdminItem>
      rotuloBusca="Buscar pelo perfil ou pelo título do trabalho"
      vazio="Nenhum trabalho encontrado."
      rotuloMotivo="Motivo da remoção (fica no registro; a empresa é avisada, sem o motivo)"
      rotuloBotao="Remover trabalho"
      listar={listarTrabalhosAdmin}
      remover={removerTrabalhoAdmin}
      linha={(t) => (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">{t.titulo}</p>
            <Badge tom="neutral">{t.fotos === 1 ? "1 foto" : `${t.fotos} fotos`}</Badge>
          </div>
          <p className="text-sm text-foreground/90">
            de{" "}
            <Link href={`/empresas/${t.perfilSlug}`} className="font-medium hover:text-primary">
              {t.perfilNome}
            </Link>{" "}
            · {formatarDataBr(t.criadoEm)}
          </p>
          {t.descricao && <p className="line-clamp-2 whitespace-pre-line text-sm text-muted">{t.descricao}</p>}
        </div>
      )}
    />
  );
}
