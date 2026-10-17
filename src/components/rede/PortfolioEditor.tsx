"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DirecaoMovimento, MeuPortfolio, ResultadoAction, ServicoInput, TrabalhoInput, TrabalhoItem } from "@/types";
import { portfolioRepositorio as repo } from "@/services/data";
import { enviarImagem, reduzirImagem } from "@/lib/imagem";
import { formatarDataBr } from "@/lib/rede/texto";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { TrabalhoModal } from "./TrabalhoModal";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";

const TIPOS_ACEITOS = "image/jpeg,image/png,image/webp";

export function PortfolioEditor() {
  const [dados, setDados] = useState<MeuPortfolio | null>(null);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [servicos, setServicos] = useState<ServicoInput[]>([]);
  const [salvandoServicos, setSalvandoServicos] = useState(false);
  const [modal, setModal] = useState<{ trabalho: TrabalhoItem | null } | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<string | null>(null);
  const entradaLogo = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    const r = await repo.obter();
    if (!r.ok) {
      setErroCarga(r.mensagem);
      return;
    }
    setDados(r.dados);
    setServicos(r.dados.servicos.map((s) => ({ id: s.id, nome: s.nome, descricao: s.descricao })));
  }, []);

  useEffect(() => {
    carregar().catch(() => setErroCarga("Não foi possível carregar agora. Tente de novo."));
  }, [carregar]);

  /** Roda uma action, mostra o erro (ou o aviso) e recarrega. Devolve a mensagem de erro, se houver. */
  async function executar<T>(acao: () => Promise<ResultadoAction<T>>, sucesso?: string): Promise<string | null> {
    setErro(null);
    setAviso(null);
    try {
      const r = await acao();
      if (!r.ok) {
        setErro(r.mensagem);
        return r.mensagem;
      }
      if (sucesso) setAviso(sucesso);
      await carregar();
      return null;
    } catch (e) {
      const mensagem = mensagemDeErro(e);
      setErro(mensagem);
      return mensagem;
    }
  }

  async function enviarArquivos(arquivos: FileList | null, destino: { tipo: "logo" } | { tipo: "portfolio"; trabalhoId: string }) {
    if (!arquivos || arquivos.length === 0) return;
    setErro(null);
    setAviso(null);
    setEnviando(destino.tipo === "logo" ? "logo" : destino.trabalhoId);
    try {
      for (const arquivo of Array.from(arquivos)) {
        let reduzida: Blob;
        try {
          reduzida = await reduzirImagem(arquivo);
        } catch (e) {
          setErro(mensagemDeErro(e));
          break;
        }
        const r = await enviarImagem(reduzida, destino);
        if (!r.ok) {
          setErro(r.mensagem ?? "Não foi possível enviar a imagem.");
          break;
        }
      }
      await carregar();
    } finally {
      setEnviando(null);
    }
  }

  async function salvarListaServicos() {
    setSalvandoServicos(true);
    await executar(() => repo.salvarServicos(servicos.filter((s) => s.nome.trim() !== "")), "Serviços salvos.");
    setSalvandoServicos(false);
  }

  if (erroCarga) {
    return <Card role="alert" className="max-w-2xl border-danger bg-danger-bg text-sm text-danger">{erroCarga}</Card>;
  }
  if (!dados) return <Card className="h-64 max-w-2xl animate-pulse bg-surface-2" aria-busy="true">{null}</Card>;

  const galeriasExistentes = [...new Set(dados.trabalhos.map((t) => t.galeria).filter((g): g is string => !!g))];

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      {erro && (
        <p role="alert" className="rounded-lg border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
          {erro}
        </p>
      )}
      {aviso && (
        <p role="status" className="rounded-lg border border-success bg-success-bg px-3 py-2 text-sm text-success">
          {aviso}
        </p>
      )}

      <p className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted">
        As imagens que você enviar ficam <strong className="text-foreground">públicas</strong> quando o perfil estiver publicado. Não envie fotos com
        rostos, placas de veículos, documentos ou endereços de terceiros sem autorização.
      </p>

      <section className="flex flex-col gap-3" aria-labelledby="sec-logo">
        <h2 id="sec-logo" className="text-base font-semibold text-foreground">
          Logo ou foto do perfil
        </h2>
        <Card className="flex flex-wrap items-center gap-4">
          {dados.logoArquivoId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/arquivos/${dados.logoArquivoId}`} alt="Logo atual" className="h-16 w-16 rounded-lg border border-border object-cover" />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/15 text-xs text-muted">Sem logo</span>
          )}
          <div className="flex flex-wrap gap-2">
            <input
              ref={entradaLogo}
              type="file"
              accept={TIPOS_ACEITOS}
              className="sr-only"
              aria-label="Escolher imagem do logo"
              onChange={(e) => {
                void enviarArquivos(e.target.files, { tipo: "logo" });
                e.target.value = "";
              }}
            />
            <Button type="button" variante="outline" disabled={enviando === "logo"} onClick={() => entradaLogo.current?.click()}>
              {enviando === "logo" ? "Enviando…" : dados.logoArquivoId ? "Trocar logo" : "Enviar logo"}
            </Button>
            {dados.logoArquivoId && (
              <Button type="button" variante="ghost" onClick={() => executar(() => repo.removerLogo(), "Logo removido.")}>
                Remover
              </Button>
            )}
          </div>
        </Card>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="sec-servicos">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="sec-servicos" className="text-base font-semibold text-foreground">
            Serviços oferecidos
          </h2>
          <span className="text-xs text-muted tabular-nums">
            {servicos.length}/{dados.limites.servicos}
          </span>
        </div>
        <Card className="flex flex-col gap-3">
          {servicos.length === 0 && <p className="text-sm text-muted">Liste o que você faz. Aparece no seu perfil público.</p>}
          {servicos.map((s, i) => (
            <div key={s.id ?? `novo-${i}`} className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end">
              <Input
                label={i === 0 ? "Serviço" : undefined}
                aria-label={`Serviço ${i + 1}`}
                value={s.nome}
                onChange={(e) => setServicos((lista) => lista.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))}
                maxLength={60}
              />
              <Input
                label={i === 0 ? "Descrição curta (opcional)" : undefined}
                aria-label={`Descrição do serviço ${i + 1}`}
                value={s.descricao ?? ""}
                onChange={(e) => setServicos((lista) => lista.map((x, j) => (j === i ? { ...x, descricao: e.target.value } : x)))}
                maxLength={200}
              />
              <Button
                type="button"
                variante="ghost"
                aria-label={`Remover serviço ${i + 1}`}
                onClick={() => setServicos((lista) => lista.filter((_, j) => j !== i))}
              >
                Remover
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variante="outline"
              disabled={servicos.length >= dados.limites.servicos}
              onClick={() => setServicos((lista) => [...lista, { nome: "" }])}
            >
              + Adicionar serviço
            </Button>
            <Button type="button" onClick={salvarListaServicos} disabled={salvandoServicos} aria-busy={salvandoServicos}>
              {salvandoServicos ? "Salvando…" : "Salvar serviços"}
            </Button>
          </div>
        </Card>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="sec-trabalhos">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="sec-trabalhos" className="text-base font-semibold text-foreground">
            Trabalhos realizados
          </h2>
          <span className="text-xs text-muted tabular-nums">
            {dados.trabalhos.length}/{dados.limites.trabalhos} trabalhos · {dados.totalArquivos}/{dados.limites.arquivos} imagens
          </span>
        </div>
        <div>
          <Button type="button" onClick={() => setModal({ trabalho: null })} disabled={dados.trabalhos.length >= dados.limites.trabalhos}>
            + Novo trabalho
          </Button>
        </div>

        {dados.trabalhos.length === 0 ? (
          <Card className="text-sm text-muted">Nenhum trabalho ainda. Mostre fotos de obras e serviços que você já fez.</Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {dados.trabalhos.map((t, indice) => {
              const servico = dados.servicos.find((s) => s.id === t.servicoId);
              const cheio = t.fotos.length >= dados.limites.fotosPorTrabalho;
              return (
                <li key={t.id}>
                  <Card className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-medium text-foreground">{t.titulo}</span>
                      {servico && <Badge tom="neutral">{servico.nome}</Badge>}
                      {t.galeria && <Badge tom="info">{t.galeria}</Badge>}
                      {t.dataTrabalho && <span className="text-xs text-muted tabular-nums">{formatarDataBr(`${t.dataTrabalho}T12:00:00Z`)}</span>}
                    </div>
                    {t.descricao && <p className="line-clamp-3 whitespace-pre-line text-sm text-foreground/90">{t.descricao}</p>}

                    {t.fotos.length > 0 && (
                      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {t.fotos.map((f, i) => (
                          <li key={f.id} className="flex flex-col gap-1">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/arquivos/${f.arquivoId}`}
                              alt={`${t.titulo}, foto ${i + 1}`}
                              loading="lazy"
                              className="aspect-[4/3] w-full rounded-lg border border-border object-cover"
                            />
                            <div className="flex justify-between gap-1">
                              <Button type="button" tamanho="sm" variante="ghost" disabled={i === 0} aria-label={`Mover foto ${i + 1} para antes`} onClick={() => executar(() => repo.moverFoto(f.id, "subir"))}>
                                ←
                              </Button>
                              <Button type="button" tamanho="sm" variante="ghost" aria-label={`Excluir foto ${i + 1}`} onClick={() => executar(() => repo.excluirFoto(f.id))}>
                                ✕
                              </Button>
                              <Button type="button" tamanho="sm" variante="ghost" disabled={i === t.fotos.length - 1} aria-label={`Mover foto ${i + 1} para depois`} onClick={() => executar(() => repo.moverFoto(f.id, "descer"))}>
                                →
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      <label
                        className={`inline-flex h-9 cursor-pointer items-center rounded-lg border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-2 ${cheio || enviando === t.id ? "pointer-events-none opacity-50" : ""}`}
                      >
                        {enviando === t.id ? "Enviando…" : cheio ? "Limite de fotos" : "+ Adicionar fotos"}
                        <input
                          type="file"
                          accept={TIPOS_ACEITOS}
                          multiple
                          disabled={cheio || enviando === t.id}
                          className="sr-only"
                          aria-label={`Adicionar fotos ao trabalho ${t.titulo}`}
                          onChange={(e) => {
                            void enviarArquivos(e.target.files, { tipo: "portfolio", trabalhoId: t.id });
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <Button type="button" tamanho="sm" variante="outline" onClick={() => setModal({ trabalho: t })}>
                        Editar
                      </Button>
                      <Button type="button" tamanho="sm" variante="ghost" disabled={indice === 0} aria-label={`Subir ${t.titulo}`} onClick={() => executar(() => repo.moverTrabalho(t.id, "subir" as DirecaoMovimento))}>
                        ↑
                      </Button>
                      <Button type="button" tamanho="sm" variante="ghost" disabled={indice === dados.trabalhos.length - 1} aria-label={`Descer ${t.titulo}`} onClick={() => executar(() => repo.moverTrabalho(t.id, "descer"))}>
                        ↓
                      </Button>
                      {confirmandoExclusao === t.id ? (
                        <Button
                          type="button"
                          tamanho="sm"
                          variante="danger"
                          onClick={async () => {
                            await executar(() => repo.excluirTrabalho(t.id), "Trabalho excluído.");
                            setConfirmandoExclusao(null);
                          }}
                        >
                          Confirmar exclusão
                        </Button>
                      ) : (
                        <Button type="button" tamanho="sm" variante="ghost" onClick={() => setConfirmandoExclusao(t.id)}>
                          Excluir
                        </Button>
                      )}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {modal && (
        <TrabalhoModal
          trabalho={modal.trabalho}
          servicos={dados.servicos}
          galeriasExistentes={galeriasExistentes}
          aoFechar={() => setModal(null)}
          aoSalvar={async (input: TrabalhoInput) => {
            const mensagem = await executar(
              () => (modal.trabalho ? repo.atualizarTrabalho(modal.trabalho.id, input) : repo.criarTrabalho(input)),
              modal.trabalho ? "Trabalho atualizado." : "Trabalho criado. Agora adicione as fotos.",
            );
            if (!mensagem) setModal(null);
            return mensagem;
          }}
        />
      )}
    </div>
  );
}
