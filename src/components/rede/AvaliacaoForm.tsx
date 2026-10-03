"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AvaliacaoParaEditar, MinhaAvaliacao } from "@/types";
import { redeRepositorio } from "@/services/data";
import { ASPECTOS_NEGATIVOS, ASPECTOS_POSITIVOS } from "@/lib/rede/aspectos";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/cn";

const CAMINHO_ESTRELA = "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";
const ROTULOS_NOTA = ["Muito ruim", "Ruim", "Regular", "Bom", "Excelente"];
const LIMITE_COMENTARIO = 1500;

function SeletorNota({ valor, aoMudar }: { valor: number; aoMudar: (n: number) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-foreground">Nota</legend>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className="relative cursor-pointer rounded-md p-1 focus-within:ring-2 focus-within:ring-primary"
            title={ROTULOS_NOTA[n - 1]}
          >
            <input
              type="radio"
              name="nota"
              value={n}
              checked={valor === n}
              onChange={() => aoMudar(n)}
              className="sr-only"
              aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"} — ${ROTULOS_NOTA[n - 1]}`}
            />
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className={cn("h-9 w-9 transition-colors", n <= valor ? "text-primary" : "text-muted/40 hover:text-primary/60")}
              fill="currentColor"
            >
              <path d={CAMINHO_ESTRELA} />
            </svg>
          </label>
        ))}
        <span className="ml-2 text-sm text-muted" aria-live="polite">
          {valor > 0 ? ROTULOS_NOTA[valor - 1] : "Escolha de 1 a 5"}
        </span>
      </div>
    </fieldset>
  );
}

function Chips({
  titulo,
  opcoes,
  marcadas,
  aoAlternar,
  tom,
}: {
  titulo: string;
  opcoes: readonly { chave: string; rotulo: string }[];
  marcadas: string[];
  aoAlternar: (chave: string) => void;
  tom: "positivo" | "negativo";
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-foreground">{titulo}</legend>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((o) => {
          const ativa = marcadas.includes(o.chave);
          return (
            <button
              key={o.chave}
              type="button"
              aria-pressed={ativa}
              onClick={() => aoAlternar(o.chave)}
              className={cn(
                "h-9 rounded-full border px-3 text-sm font-medium transition-colors",
                ativa
                  ? tom === "positivo"
                    ? "border-success bg-success-bg text-success"
                    : "border-danger bg-danger-bg text-danger"
                  : "border-border text-foreground hover:bg-surface-2",
              )}
            >
              {o.rotulo}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function AvaliacaoForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [carga, setCarga] = useState<AvaliacaoParaEditar | null>(null);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [form, setForm] = useState<MinhaAvaliacao>({ nota: 0, pros: [], contras: [] });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    redeRepositorio
      .obterAvaliacaoParaEditar(slug)
      .then((r) => {
        if (cancelado) return;
        if (!r.ok) {
          setErroCarga(r.mensagem);
          return;
        }
        setCarga(r.dados);
        if (r.dados.avaliacao) setForm(r.dados.avaliacao);
      })
      .catch(() => {
        if (!cancelado) setErroCarga("Não foi possível carregar agora. Tente de novo.");
      });
    return () => {
      cancelado = true;
    };
  }, [slug]);

  function alternar(campo: "pros" | "contras", chave: string) {
    setForm((atual) => ({
      ...atual,
      [campo]: atual[campo].includes(chave) ? atual[campo].filter((c) => c !== chave) : [...atual[campo], chave],
    }));
    setErro(null);
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (form.nota < 1) {
      setErro("Escolha uma nota de 1 a 5.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const resultado = await redeRepositorio.salvarAvaliacao({ ...form, perfilSlug: slug });
      if (!resultado.ok) {
        setErro(resultado.mensagem);
        return;
      }
      router.push(`/empresas/${slug}#avaliacoes`);
    } catch {
      setErro("Não foi possível enviar agora. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  if (erroCarga) {
    return (
      <Card role="alert" className="flex flex-col gap-2 border-danger bg-danger-bg text-sm text-danger">
        <p>{erroCarga}</p>
        <Link href="/rede" className="w-fit font-medium underline underline-offset-4">
          Voltar à busca
        </Link>
      </Card>
    );
  }
  if (!carga) return <Card className="h-64 animate-pulse bg-surface-2" aria-busy="true">{null}</Card>;

  const editando = carga.avaliacao !== null;

  return (
    <form onSubmit={enviar} className="flex max-w-2xl flex-col gap-6" noValidate>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">
          {editando ? "Editar avaliação de" : "Avaliar"} {carga.perfil.nome}
        </h2>
        <p className="text-sm text-muted">
          Sua avaliação é pública e aparece com o nome da sua empresa. Cada empresa faz uma avaliação por perfil; você
          pode editá-la depois, e as versões anteriores ficam registradas.
        </p>
      </div>

      <SeletorNota valor={form.nota} aoMudar={(n) => { setForm((f) => ({ ...f, nota: n })); setErro(null); }} />

      <Textarea
        id="avaliacao-comentario"
        label="Comentário (opcional)"
        placeholder="Conte como foi trabalhar com este profissional: prazo, qualidade, comunicação."
        value={form.comentario ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, comentario: e.target.value }))}
        maxLength={LIMITE_COMENTARIO}
        rows={5}
      />
      <p className="-mt-4 text-right text-xs text-muted tabular-nums">
        {(form.comentario ?? "").length}/{LIMITE_COMENTARIO}
      </p>

      <Chips titulo="Pontos positivos" opcoes={ASPECTOS_POSITIVOS} marcadas={form.pros} aoAlternar={(c) => alternar("pros", c)} tom="positivo" />
      <Chips titulo="Pontos negativos" opcoes={ASPECTOS_NEGATIVOS} marcadas={form.contras} aoAlternar={(c) => alternar("contras", c)} tom="negativo" />

      {erro && (
        <p role="alert" className="rounded-lg border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
          {erro}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={enviando} aria-busy={enviando} className="min-w-40">
          {enviando ? "Enviando…" : editando ? "Salvar alterações" : "Publicar avaliação"}
        </Button>
        <Link href={`/empresas/${slug}`}>
          <Button type="button" variante="ghost">
            Cancelar
          </Button>
        </Link>
      </div>
    </form>
  );
}
