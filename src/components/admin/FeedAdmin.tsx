"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";
import { tempoRelativo } from "@/lib/feed";
import {
  alterarStatusPostagemAdmin,
  decidirDenunciaPostagem,
  listarDenunciasPostagem,
  listarPostagensAdmin,
  type DenunciaPostagemAdmin,
  type PostagemAdmin,
} from "@/services/data/server/feedAdminActions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PainelConfirmacao } from "./PainelConfirmacao";

const ROTULO_MOTIVO: Record<string, string> = {
  spam: "Spam ou propaganda",
  conteudo_ofensivo: "Conteúdo ofensivo",
  fraude: "Golpe ou fraude",
  informacao_falsa: "Informação falsa",
  outro: "Outro motivo",
};

function Fotos({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {urls.map((u, i) => (
        <a key={u} href={u} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={u} alt={`Foto ${i + 1}`} className="h-20 w-20 rounded-lg border border-border object-cover" />
        </a>
      ))}
    </div>
  );
}

export function FeedAdmin() {
  const [denuncias, setDenuncias] = useState<DenunciaPostagemAdmin[] | null>(null);
  const [posts, setPosts] = useState<PostagemAdmin[] | null>(null);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // Qual ação está pedindo motivo e senha: "d:<id>:ocultar|manter" ou "p:<id>:oculta|publicada".
  const [alvo, setAlvo] = useState<string | null>(null);

  const carregar = useCallback(async (termo: string) => {
    const [d, p] = await Promise.all([listarDenunciasPostagem(), listarPostagensAdmin(termo)]);
    setDenuncias(d);
    setPosts(p);
  }, []);

  useEffect(() => {
    carregar("").catch((e) => setErro(mensagemDeErro(e)));
  }, [carregar]);

  async function confirmar(motivo: string, senha: string) {
    if (!alvo) return;
    const [tipo, id, valor] = alvo.split(":") as [string, string, string];
    setOcupado(true);
    setErro(null);
    try {
      const r =
        tipo === "d"
          ? await decidirDenunciaPostagem({ id, decisao: valor, motivo }, senha)
          : await alterarStatusPostagemAdmin({ id, status: valor, motivo }, senha);
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
    <div className="flex max-w-3xl flex-col gap-8">
      {erro && (
        <p role="alert" className="rounded-lg border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
          {erro}
        </p>
      )}

      <section className="flex flex-col gap-3" aria-labelledby="titulo-denuncias-feed">
        <h2 id="titulo-denuncias-feed" className="text-lg font-semibold text-foreground">
          Denúncias abertas {denuncias ? `(${denuncias.length})` : ""}
        </h2>
        {!denuncias ? (
          <Card className="h-20 animate-pulse bg-surface-2" aria-busy="true">
            {null}
          </Card>
        ) : denuncias.length === 0 ? (
          <Card className="text-sm text-muted">Nenhuma denúncia aberta.</Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {denuncias.map((d) => (
              <li key={d.id}>
                <Card className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge tom="warning">{ROTULO_MOTIVO[d.motivo] ?? d.motivo}</Badge>
                    <Badge tom="neutral">{d.alvo === "comentario" ? "Comentário" : "Postagem"}</Badge>
                    <span className="text-muted">
                      de {d.denunciante}, {tempoRelativo(d.criadoEm)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">
                    <strong>Autor:</strong>{" "}
                    <Link href={`/empresas/${d.autorSlug}`} className="text-primary underline underline-offset-2" target="_blank">
                      {d.autorNome}
                    </Link>
                  </p>
                  {d.texto && <p className="whitespace-pre-wrap break-words rounded-lg bg-surface-2 p-3 text-sm text-foreground">{d.texto}</p>}
                  <Fotos urls={d.fotos} />
                  <p className="text-sm text-muted">
                    <strong className="text-foreground">O que o denunciante disse:</strong> {d.descricao}
                  </p>
                  {alvo?.startsWith(`d:${d.id}:`) ? (
                    <PainelConfirmacao
                      rotuloMotivo={alvo.endsWith(":ocultar") ? "Motivo de ocultar (registro interno)" : "Por que manter (registro interno)"}
                      rotuloBotao={alvo.endsWith(":ocultar") ? "Ocultar conteúdo" : "Manter no ar"}
                      perigo={alvo.endsWith(":ocultar")}
                      ocupado={ocupado}
                      aoConfirmar={confirmar}
                      aoCancelar={() => setAlvo(null)}
                    />
                  ) : (
                    <div className="flex gap-2">
                      <Button tamanho="sm" variante="danger" disabled={ocupado} onClick={() => { setErro(null); setAlvo(`d:${d.id}:ocultar`); }}>
                        Ocultar
                      </Button>
                      <Button tamanho="sm" variante="outline" disabled={ocupado} onClick={() => { setErro(null); setAlvo(`d:${d.id}:manter`); }}>
                        Manter no ar
                      </Button>
                    </div>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="titulo-posts-feed">
        <h2 id="titulo-posts-feed" className="text-lg font-semibold text-foreground">
          Postagens recentes
        </h2>
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            carregar(busca).catch((err) => setErro(mensagemDeErro(err)));
          }}
          className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end"
        >
          <Input label="Buscar por perfil ou texto" value={busca} onChange={(e) => setBusca(e.target.value)} maxLength={80} />
          <Button type="submit" variante="outline" className="h-11">
            Buscar
          </Button>
        </form>
        {!posts ? (
          <Card className="h-20 animate-pulse bg-surface-2" aria-busy="true">
            {null}
          </Card>
        ) : posts.length === 0 ? (
          <Card className="text-sm text-muted">Nenhuma postagem.</Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {posts.map((p) => {
              const proxima = p.status === "publicada" ? "oculta" : "publicada";
              return (
                <li key={p.id}>
                  <Card className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Link href={`/empresas/${p.autorSlug}`} target="_blank" className="font-semibold text-foreground hover:text-primary">
                        {p.autorNome}
                      </Link>
                      <Badge tom={p.status === "publicada" ? "success" : "warning"}>{p.status === "publicada" ? "No ar" : "Oculta"}</Badge>
                      {p.denunciasAbertas > 0 && <Badge tom="danger">{`${p.denunciasAbertas} denúncia(s)`}</Badge>}
                      <span className="text-muted">{tempoRelativo(p.criadoEm)}</span>
                    </div>
                    {p.texto && <p className="whitespace-pre-wrap break-words text-sm text-foreground">{p.texto}</p>}
                    <Fotos urls={p.fotos} />
                    {alvo === `p:${p.id}:${proxima}` ? (
                      <PainelConfirmacao
                        rotuloMotivo="Motivo (registro interno)"
                        rotuloBotao={proxima === "oculta" ? "Ocultar postagem" : "Restaurar postagem"}
                        perigo={proxima === "oculta"}
                        ocupado={ocupado}
                        aoConfirmar={confirmar}
                        aoCancelar={() => setAlvo(null)}
                      />
                    ) : (
                      <div>
                        <Button tamanho="sm" variante={proxima === "oculta" ? "danger" : "outline"} disabled={ocupado} onClick={() => { setErro(null); setAlvo(`p:${p.id}:${proxima}`); }}>
                          {proxima === "oculta" ? "Ocultar" : "Restaurar"}
                        </Button>
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
