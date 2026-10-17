"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { AcaoDecisaoDenuncia, PaginaDenunciasAdmin } from "@/types";
import { denunciasAdminRepositorio as repo } from "@/services/data";
import { ROTULOS_STATUS_DENUNCIA, rotuloMotivoDenuncia } from "@/lib/rede/aspectos";
import { formatarDataBr } from "@/lib/rede/texto";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { EstrelasNota } from "@/components/rede/EstrelasNota";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";

type AcaoPainel = "informacoes" | AcaoDecisaoDenuncia;

const ROTULO_ACAO: Record<AcaoPainel, string> = {
  informacoes: "Pedir informações",
  manter: "Manter o conteúdo (rejeitar denúncia)",
  ocultar_avaliacao: "Ocultar avaliação",
  remover_avaliacao: "Remover avaliação",
  suspender_perfil: "Suspender perfil",
};

const EXIGE_SENHA: Record<AcaoPainel, boolean> = {
  informacoes: false,
  manter: false,
  ocultar_avaliacao: true,
  remover_avaliacao: true,
  suspender_perfil: true,
};

function tomDoStatus(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "resolvida") return "success";
  if (status === "rejeitada") return "neutral";
  if (status === "aguardando_informacoes") return "warning";
  return "info";
}

export function DenunciasAdmin() {
  const [filtro, setFiltro] = useState("pendentes");
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<PaginaDenunciasAdmin | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [painel, setPainel] = useState<{ id: string; acao: AcaoPainel } | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [observacao, setObservacao] = useState("");
  const [senha, setSenha] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async (filtroAtual: string, paginaAtual: number) => {
    setDados(await repo.listar(filtroAtual, paginaAtual));
  }, []);

  useEffect(() => {
    carregar(filtro, pagina).catch((e) => setErro(mensagemDeErro(e)));
  }, [carregar, filtro, pagina]);

  const itens = dados?.itens ?? null;

  function abrirPainel(id: string, acao: AcaoPainel) {
    setPainel({ id, acao });
    setMensagem("");
    setObservacao("");
    setSenha("");
    setErro(null);
  }

  async function assumir(id: string) {
    setOcupado(true);
    setErro(null);
    try {
      const r = await repo.assumir(id);
      if (!r.ok) setErro(r.mensagem);
      else await carregar(filtro, pagina);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  async function confirmar() {
    if (!painel) return;
    setOcupado(true);
    setErro(null);
    try {
      const r =
        painel.acao === "informacoes"
          ? await repo.solicitarInformacoes(painel.id, mensagem)
          : await repo.decidir(
              painel.id,
              painel.acao,
              mensagem,
              observacao || undefined,
              senha || undefined,
              itens?.find((i) => i.id === painel.id)?.avaliacao?.versao,
            );
      if (!r.ok) {
        setErro(r.mensagem);
        return;
      }
      setPainel(null);
      setSenha("");
      await carregar(filtro, pagina);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-full max-w-xs">
        <Select
          label="Mostrar"
          value={filtro}
          onChange={(e) => {
            setFiltro(e.target.value);
            setPagina(1);
            setPainel(null);
          }}
        >
          <option value="pendentes">Pendentes (mais antigas primeiro)</option>
          <option value="todas">Todas</option>
          {Object.entries(ROTULOS_STATUS_DENUNCIA).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </Select>
        </div>
        {dados && (
          <p className="pb-3 text-sm text-muted" aria-live="polite">
            {dados.abertas === 1 ? "1 denúncia aberta" : `${dados.abertas} denúncias abertas`}
          </p>
        )}
      </div>

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
        <Card className="text-sm text-muted">Nenhuma denúncia nesse filtro.</Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {itens.map((d) => {
            const encerrada = d.status === "resolvida" || d.status === "rejeitada";
            const acoesDecisao: AcaoDecisaoDenuncia[] =
              d.alvoTipo === "avaliacao" ? ["manter", "ocultar_avaliacao", "remover_avaliacao"] : ["manter", "suspender_perfil"];
            return (
              <li key={d.id}>
                <Card className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Badge tom={tomDoStatus(d.status)}>{ROTULOS_STATUS_DENUNCIA[d.status] ?? d.status}</Badge>
                    <Badge tom="neutral">{d.alvoTipo === "avaliacao" ? "Avaliação" : "Perfil"}</Badge>
                    <span className="text-sm font-medium text-foreground">{rotuloMotivoDenuncia(d.motivo)}</span>
                    <span className="text-xs text-muted">
                      por {d.denuncianteNome} · {formatarDataBr(d.criadoEm)}
                      {d.adminResponsavelNome && <> · responsável: {d.adminResponsavelNome}</>}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Denúncia</p>
                    <p className="whitespace-pre-line text-sm text-foreground/90">{d.descricao}</p>
                    {d.complemento && (
                      <p className="whitespace-pre-line text-sm text-foreground/90">
                        <span className="font-medium">Complemento do denunciante: </span>
                        {d.complemento}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 rounded-lg bg-surface px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Conteúdo denunciado</p>
                    {d.avaliacao && (
                      <>
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <EstrelasNota nota={d.avaliacao.nota} tamanho="sm" />
                          <span className="text-foreground">
                            {d.avaliacao.avaliadorNome} →{" "}
                            <Link href={`/empresas/${d.avaliacao.perfilSlug}`} className="font-medium hover:text-primary">
                              {d.avaliacao.perfilNome}
                            </Link>
                          </span>
                          <Badge tom={d.avaliacao.status === "publicada" ? "success" : "warning"}>
                            {d.avaliacao.status === "publicada" ? "Publicada" : d.avaliacao.status === "oculta" ? "Oculta" : "Removida"}
                          </Badge>
                        </div>
                        {d.avaliacao.comentario && (
                          <p className="whitespace-pre-line text-sm text-foreground/90">{d.avaliacao.comentario}</p>
                        )}
                      </>
                    )}
                    {d.perfil && (
                      <p className="text-sm text-foreground">
                        <Link href={`/empresas/${d.perfil.slug}`} className="font-medium hover:text-primary">
                          {d.perfil.nome}
                        </Link>{" "}
                        <span className="text-muted">({d.perfil.status})</span>
                      </p>
                    )}
                  </div>

                  {encerrada && (
                    <div className="flex flex-col gap-1 text-sm">
                      {d.mensagemAoDenunciante && (
                        <p className="text-foreground/90">
                          <span className="font-medium">Mensagem ao denunciante: </span>
                          {d.mensagemAoDenunciante}
                        </p>
                      )}
                      {d.observacaoAdmin && (
                        <p className="text-muted">
                          <span className="font-medium">Observação interna: </span>
                          {d.observacaoAdmin}
                        </p>
                      )}
                    </div>
                  )}

                  {!encerrada && painel?.id !== d.id && (
                    <div className="flex flex-wrap gap-2">
                      {d.status === "aberta" && (
                        <Button type="button" tamanho="sm" variante="outline" disabled={ocupado} onClick={() => assumir(d.id)}>
                          Assumir análise
                        </Button>
                      )}
                      {d.status !== "aguardando_informacoes" && (
                        <Button type="button" tamanho="sm" variante="outline" onClick={() => abrirPainel(d.id, "informacoes")}>
                          Pedir informações
                        </Button>
                      )}
                      {acoesDecisao.map((acao) => (
                        <Button
                          key={acao}
                          type="button"
                          tamanho="sm"
                          variante={acao === "manter" ? "outline" : "danger"}
                          onClick={() => abrirPainel(d.id, acao)}
                        >
                          {acao === "manter" ? "Manter" : ROTULO_ACAO[acao]}
                        </Button>
                      ))}
                    </div>
                  )}

                  {painel?.id === d.id && (
                    <div className="flex flex-col gap-3 border-t border-border pt-3">
                      <p className="text-sm font-medium text-foreground">{ROTULO_ACAO[painel.acao]}</p>
                      <Textarea
                        id={`mensagem-${d.id}`}
                        label={
                          painel.acao === "informacoes"
                            ? "O que o denunciante precisa esclarecer"
                            : "Mensagem ao denunciante (ele vê o resultado)"
                        }
                        value={mensagem}
                        onChange={(e) => setMensagem(e.target.value)}
                        maxLength={500}
                        rows={3}
                      />
                      {painel.acao !== "informacoes" && (
                        <Textarea
                          id={`observacao-${d.id}`}
                          label="Observação interna (opcional, só a administração vê)"
                          value={observacao}
                          onChange={(e) => setObservacao(e.target.value)}
                          maxLength={1000}
                          rows={2}
                        />
                      )}
                      {EXIGE_SENHA[painel.acao] && (
                        <Input
                          id={`senha-${d.id}`}
                          type="password"
                          label="Confirme sua senha (ação que tira conteúdo do ar)"
                          autoComplete="current-password"
                          value={senha}
                          onChange={(e) => setSenha(e.target.value)}
                          maxLength={200}
                        />
                      )}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          tamanho="sm"
                          variante={EXIGE_SENHA[painel.acao] ? "danger" : "primary"}
                          disabled={ocupado || mensagem.trim().length < 5 || (EXIGE_SENHA[painel.acao] && senha.length === 0)}
                          onClick={confirmar}
                        >
                          Confirmar
                        </Button>
                        <Button type="button" tamanho="sm" variante="ghost" onClick={() => setPainel(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {dados && dados.totalPaginas > 1 && (
        <nav aria-label="Páginas da fila" className="flex items-center justify-between gap-3 text-sm">
          <Button type="button" tamanho="sm" variante="outline" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
            ← Anterior
          </Button>
          <span className="text-muted tabular-nums">
            Página {dados.pagina} de {dados.totalPaginas}
          </span>
          <Button type="button" tamanho="sm" variante="outline" disabled={pagina >= dados.totalPaginas} onClick={() => setPagina((p) => p + 1)}>
            Próxima →
          </Button>
        </nav>
      )}
    </div>
  );
}
