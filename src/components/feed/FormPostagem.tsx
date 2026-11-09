"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconeFoto } from "@/components/layout/icones";
import { Button } from "@/components/ui/Button";
import { MAX_FOTOS_POSTAGEM, MAX_TEXTO_POSTAGEM } from "@/lib/feed";
import { reduzirImagem } from "@/lib/imagem";

interface Foto {
  chave: string;
  blob: Blob;
  previa: string;
}

/** Nova postagem: texto e até 4 fotos, reduzidas no aparelho antes do envio e mandadas numa só requisição. */
export function FormPostagem({ nomeDoPerfil }: { nomeDoPerfil: string }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [lendo, setLendo] = useState(false);
  const entrada = useRef<HTMLInputElement | null>(null);
  const fotosRef = useRef<Foto[]>([]);

  useEffect(() => {
    fotosRef.current = fotos;
  }, [fotos]);

  // Libera as prévias (object URLs) ao sair da tela.
  useEffect(() => () => fotosRef.current.forEach((f) => URL.revokeObjectURL(f.previa)), []);

  async function escolher(arquivos: FileList | null) {
    if (!arquivos || arquivos.length === 0) return;
    setErro(null);
    setLendo(true);
    const novas: Foto[] = [];
    try {
      const vagas = MAX_FOTOS_POSTAGEM - fotos.length;
      for (const arquivo of Array.from(arquivos).slice(0, vagas)) {
        const blob = await reduzirImagem(arquivo);
        novas.push({ chave: crypto.randomUUID(), blob, previa: URL.createObjectURL(blob) });
      }
      if (arquivos.length > vagas) setErro(`Cada postagem aceita até ${MAX_FOTOS_POSTAGEM} fotos.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler a foto.");
    }
    setFotos((atual) => [...atual, ...novas]);
    setLendo(false);
    if (entrada.current) entrada.current.value = "";
  }

  function remover(chave: string) {
    setFotos((atual) => {
      const alvo = atual.find((f) => f.chave === chave);
      if (alvo) URL.revokeObjectURL(alvo.previa);
      return atual.filter((f) => f.chave !== chave);
    });
  }

  async function publicar() {
    setErro(null);
    setEnviando(true);
    const formulario = new FormData();
    formulario.set("texto", texto);
    for (const f of fotos) formulario.append("arquivo", f.blob, "foto.jpg");
    try {
      const resposta = await fetch("/api/postagens", { method: "POST", body: formulario });
      const dados = (await resposta.json().catch(() => null)) as { ok?: boolean; mensagem?: string } | null;
      if (resposta.ok && dados?.ok) {
        router.push("/feed");
        router.refresh();
        return;
      }
      setErro(dados?.mensagem ?? "Não foi possível publicar agora.");
    } catch {
      setErro("Sem conexão. Tente de novo.");
    }
    setEnviando(false);
  }

  const vazio = texto.trim().length === 0 && fotos.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Publicando como <strong className="text-foreground">{nomeDoPerfil}</strong>. Qualquer pessoa pode ver a postagem.
      </p>

      <label className="flex flex-col gap-1.5">
        <span className="sr-only">Texto da postagem</span>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={MAX_TEXTO_POSTAGEM}
          rows={6}
          autoFocus
          placeholder="Mostre um trabalho, conte uma novidade ou peça indicação de um fornecedor."
          className="w-full resize-y rounded-xl border border-border bg-surface px-4 py-3 text-base text-foreground outline-none placeholder:text-muted focus:border-primary"
        />
        <span className="self-end text-xs text-muted tabular-nums">
          {texto.length}/{MAX_TEXTO_POSTAGEM}
        </span>
      </label>

      {fotos.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {fotos.map((f, i) => (
            <li key={f.chave} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.previa} alt={`Prévia da foto ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => remover(f.chave)}
                aria-label={`Remover foto ${i + 1}`}
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-sm text-white hover:bg-black"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={entrada}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          id="fotos-postagem"
          onChange={(e) => void escolher(e.target.files)}
        />
        <Button
          type="button"
          variante="outline"
          onClick={() => entrada.current?.click()}
          disabled={lendo || enviando || fotos.length >= MAX_FOTOS_POSTAGEM}
        >
          <IconeFoto className="mr-2 h-5 w-5" />
          {lendo ? "Preparando…" : `Adicionar fotos (${fotos.length}/${MAX_FOTOS_POSTAGEM})`}
        </Button>
      </div>

      {erro && (
        <p role="alert" className="text-sm text-danger">
          {erro}
        </p>
      )}

      <p className="text-xs text-muted">
        Você é responsável pelo que publica. Não publique conteúdo falso, ofensivo ou de terceiros sem autorização. Veja os{" "}
        <Link href="/termos" className="underline underline-offset-2">
          Termos de Uso
        </Link>
        .
      </p>

      <div className="flex gap-2">
        <Button onClick={() => void publicar()} disabled={vazio || enviando || lendo}>
          {enviando ? "Publicando…" : "Publicar"}
        </Button>
        <Button variante="ghost" onClick={() => router.back()} disabled={enviando}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
