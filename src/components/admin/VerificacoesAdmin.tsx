"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { DecisaoSolicitacao, ResultadoAction, SolicitacaoAdminItem, StatusSolicitacao, TipoVerificacao } from "@/types";
import { verificacoesAdminRepositorio as repo } from "@/services/data";
import { formatarDataBr } from "@/lib/rede/texto";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EstrelasNota } from "@/components/rede/EstrelasNota";
import { PainelConfirmacao } from "./PainelConfirmacao";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";

const TIPO: Record<TipoVerificacao, string> = {
  empresa_verificada: "Selo de verificação",
  reivindicacao_perfil: "Reivindicação de perfil",
  relacao_comprovada: "Relação comprovada",
};

const STATUS: Record<StatusSolicitacao, { rotulo: string; tom: "info" | "success" | "danger" | "neutral" | "warning" }> = {
  pendente: { rotulo: "Pendente", tom: "info" },
  aprovada: { rotulo: "Aprovada", tom: "success" },
  recusada: { rotulo: "Recusada", tom: "danger" },
  cancelada: { rotulo: "Cancelada", tom: "neutral" },
  expirada: { rotulo: "Expirada", tom: "warning" },
  revogada: { rotulo: "Desfeita", tom: "warning" },
};

function tamanho(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function VerificacoesAdmin() {
  const [aba, setAba] = useState<"pendentes" | "decididas">("pendentes");
  const [itens, setItens] = useState<SolicitacaoAdminItem[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [painel, setPainel] = useState<{ id: string; decisao: DecisaoSolicitacao | "desfazer" } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async (qual: "pendentes" | "decididas") => {
    setItens(null);
    setItens(await repo.listar(qual));
  }, []);

  useEffect(() => {
    carregar(aba).catch((e) => setErro(mensagemDeErro(e)));
  }, [aba, carregar]);

  async function executar(acao: () => Promise<ResultadoAction<null>>) {
    setOcupado(true);
    setErro(null);
    try {
      const resultado = await acao();
      if (!resultado.ok) {
        setErro(resultado.mensagem);
        return;
      }
      setPainel(null);
      await carregar(aba);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex gap-2" role="tablist" aria-label="Pedidos">
        {(["pendentes", "decididas"] as const).map((qual) => (
          <button
            key={qual}
            type="button"
            role="tab"
            aria-selected={aba === qual}
            onClick={() => setAba(qual)}
            className={`min-h-9 rounded-full border px-3.5 text-sm font-medium transition-colors ${
              aba === qual ? "border-primary bg-primary/15 text-primary" : "border-border text-muted hover:text-foreground"
            }`}
          >
            {qual === "pendentes" ? "Pendentes" : "Decididos"}
          </button>
        ))}
      </div>

      <p className="text-sm text-muted">
        Os documentos abrem como download (nunca no navegador) e cada abertura fica no registro de ações; só dá para aprovar depois de abrir o
        documento. Abra PDFs no visualizador do navegador ou em um ambiente isolado, não em leitor com script ligado. Aprovar ou recusar apaga os
        arquivos. Nada é verificado nem vinculado sem a sua decisão.
      </p>

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
        <Card className="text-sm text-muted">{aba === "pendentes" ? "Nenhum pedido esperando análise." : "Nenhum pedido decidido ainda."}</Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {itens.map((s) => {
            const aberto = painel?.id === s.id ? painel.decisao : null;
            const docsAbertos = s.documentos.filter((d) => !d.apagado);
            return (
              <li key={s.id}>
                <Card className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-semibold text-foreground">{TIPO[s.tipo]}</span>
                    <Badge tom={STATUS[s.status].tom}>{STATUS[s.status].rotulo}</Badge>
                    <span className="text-xs text-muted">pedido em {formatarDataBr(s.criadoEm)}</span>
                  </div>

                  <div className="flex flex-col gap-1 text-sm text-foreground/90">
                    <p>
                      {s.solicitante.nome} · <span className="tabular-nums">{s.solicitante.documento}</span> · <span className="break-all">{s.solicitante.email}</span>
                      {s.solicitante.verificada && <> · já verificada</>}
                    </p>
                    <p className="text-muted">
                      Nome no cadastro: <span className="font-medium text-foreground">{s.solicitante.nomeDeclarado}</span> · conta criada em{" "}
                      {formatarDataBr(s.solicitante.criadaEm)}
                    </p>
                  </div>

                  {s.receita !== undefined && (
                    <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                      <p className="text-xs font-medium text-muted">Cadastro oficial do CNPJ (consulta pública)</p>
                      {s.receita === null ? (
                        <p className="text-muted">Consulta indisponível agora: confira o CNPJ no site da Receita antes de aprovar.</p>
                      ) : (
                        <>
                          <p className={s.receita.razaoConfere ? "text-foreground" : "font-medium text-warning"}>
                            {s.receita.razaoSocial}
                            {s.receita.municipio && ` · ${s.receita.municipio}/${s.receita.uf ?? ""}`}
                            {!s.receita.razaoConfere && " (diferente do nome no cadastro)"}
                          </p>
                          <p className={s.receita.ativa ? "text-muted" : "font-medium text-danger"}>Situação cadastral: {s.receita.situacao}</p>
                          {s.receita.socios.length > 0 && <p className="text-muted">Sócios: {s.receita.socios.join(", ")}</p>}
                          <p className="text-xs text-muted">Confira se o documento enviado traz um destes nomes ligado a este CNPJ.</p>
                        </>
                      )}
                    </div>
                  )}

                  {s.perfil && (
                    <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                      <p>
                        Perfil:{" "}
                        <Link href={`/empresas/${s.perfil.slug}`} className="font-medium text-primary underline underline-offset-4">
                          {s.perfil.nome}
                        </Link>{" "}
                        ({s.perfil.tipo === "pj" ? "empresa" : "autônomo"})
                      </p>
                      <p className="text-muted">
                        Em jogo: {s.perfil.avaliacoes} {s.perfil.avaliacoes === 1 ? "avaliação" : "avaliações"} e {s.perfil.recomendacoes}{" "}
                        {s.perfil.recomendacoes === 1 ? "recomendação" : "recomendações"}.
                        {s.perfil.outrosPedidosPendentes > 0 && <span className="font-medium text-warning"> Há {s.perfil.outrosPedidosPendentes} outro(s) pedido(s) pendente(s) para este perfil.</span>}
                        {s.perfil.avaliacoesDoSolicitante > 0 && <span className="font-medium text-warning"> A solicitante já avaliou este perfil (essa avaliação sai se aprovar).</span>}
                      </p>
                      <p className={s.perfil.documentoConfere === false ? "font-medium text-danger" : "text-muted"}>
                        {s.perfil.documentoConfere === true
                          ? "O CNPJ do perfil indicado é o mesmo da empresa solicitante."
                          : s.perfil.documentoConfere === false
                            ? "O CNPJ do perfil indicado NÃO é o da empresa solicitante."
                            : "O perfil não tem CNPJ de referência: confira o nome e a identidade nos documentos."}
                      </p>
                    </div>
                  )}

                  {s.avaliacao && (
                    <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                      <p className="flex flex-wrap items-center gap-2">
                        <EstrelasNota nota={s.avaliacao.nota} tamanho="sm" />
                        <span>
                          para{" "}
                          <Link href={`/empresas/${s.avaliacao.perfilSlug}`} className="font-medium text-primary underline underline-offset-4">
                            {s.avaliacao.perfilNome}
                          </Link>
                        </span>
                      </p>
                      {s.avaliacao.comentario && <p className="line-clamp-3 whitespace-pre-line text-foreground/90">{s.avaliacao.comentario}</p>}
                      {s.avaliacao.relacaoContestada && <p className="font-medium text-warning">O avaliado respondeu que não reconhece esta relação.</p>}
                    </div>
                  )}

                  {s.observacao && <p className="text-sm text-foreground/90">Recado: {s.observacao}</p>}

                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-medium text-muted">Documentos</p>
                    {s.documentos.length === 0 ? (
                      <p className="text-sm text-warning">Nenhum documento enviado.</p>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {s.documentos.map((d, i) => (
                          <li key={d.id} className="text-sm">
                            {d.apagado ? (
                              <span className="text-muted">Documento {i + 1}: apagado</span>
                            ) : (
                              <a href={`/api/documentos/${d.id}`} className="font-medium text-primary underline underline-offset-4">
                                Baixar documento {i + 1} ({d.mime === "application/pdf" ? "PDF" : "imagem"}, {tamanho(d.tamanho)})
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {s.status !== "pendente" && s.motivoDecisao && <p className="text-sm text-foreground/90">Motivo: {s.motivoDecisao}</p>}

                  {s.status === "aprovada" && (
                    <>
                      <div className="flex justify-end">
                        <Button type="button" tamanho="sm" variante="outline" disabled={ocupado} onClick={() => setPainel({ id: s.id, decisao: "desfazer" })}>
                          Desfazer aprovação
                        </Button>
                      </div>
                      {aberto === "desfazer" && (
                        <PainelConfirmacao
                          rotuloMotivo="Motivo para desfazer (interno): revoga o selo, devolve o perfil à rede ou rebaixa a relação"
                          rotuloBotao="Confirmar e desfazer"
                          perigo
                          ocupado={ocupado}
                          aoConfirmar={(motivo, senha) => executar(() => repo.desfazer(s.id, motivo, senha))}
                          aoCancelar={() => setPainel(null)}
                        />
                      )}
                    </>
                  )}

                  {s.status === "pendente" && (
                    <>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          tamanho="sm"
                          variante="outline"
                          disabled={ocupado || docsAbertos.length === 0}
                          title={docsAbertos.length === 0 ? "Sem documento não dá para aprovar." : undefined}
                          onClick={() => setPainel({ id: s.id, decisao: "aprovar" })}
                        >
                          Aprovar
                        </Button>
                        <Button type="button" tamanho="sm" variante="danger" disabled={ocupado} onClick={() => setPainel({ id: s.id, decisao: "recusar" })}>
                          Recusar
                        </Button>
                      </div>
                      {aberto === "aprovar" && (
                        <PainelConfirmacao
                          rotuloBotao="Confirmar aprovação"
                          ocupado={ocupado}
                          aoConfirmar={(_motivo, senha) => executar(() => repo.decidir(s.id, "aprovar", undefined, senha))}
                          aoCancelar={() => setPainel(null)}
                        />
                      )}
                      {aberto === "recusar" && (
                        <PainelConfirmacao
                          rotuloMotivo="Motivo da recusa (o solicitante vai ler; diga o que falta)"
                          rotuloBotao="Confirmar recusa"
                          perigo
                          ocupado={ocupado}
                          aoConfirmar={(motivo, senha) => executar(() => repo.decidir(s.id, "recusar", motivo, senha))}
                          aoCancelar={() => setPainel(null)}
                        />
                      )}
                    </>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
