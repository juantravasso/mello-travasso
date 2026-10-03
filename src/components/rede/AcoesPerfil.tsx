"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EstadoInteracao } from "@/types";
import { redeRepositorio } from "@/services/data";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function AcoesPerfil({ slug, estado }: { slug: string; estado: EstadoInteracao }) {
  const router = useRouter();
  const [recomendado, setRecomendado] = useState(estado.jaRecomendou);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  if (!estado.logado) {
    return (
      <Card className="flex flex-col gap-2 text-sm">
        <p className="font-medium text-foreground">Já trabalhou com este perfil?</p>
        <p className="text-muted">Entre ou crie sua conta grátis para avaliar e recomendar.</p>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/login?next=${encodeURIComponent(`/empresas/${slug}`)}`}
            className="font-medium text-primary underline underline-offset-4"
          >
            Entrar
          </Link>
          <Link href="/criar-conta" className="font-medium text-primary underline underline-offset-4">
            Criar conta grátis
          </Link>
        </div>
      </Card>
    );
  }

  if (estado.proprio) {
    return (
      <Card className="flex flex-col gap-2 text-sm">
        <p className="text-muted">Este é o seu perfil. Você não pode avaliar nem recomendar a si mesmo.</p>
        <Link href="/minha-rede/avaliacoes?aba=recebidas" className="w-fit font-medium text-primary underline underline-offset-4">
          Ver avaliações recebidas
        </Link>
      </Card>
    );
  }

  function alternarRecomendacao() {
    setErro(null);
    iniciar(async () => {
      const resultado = recomendado
        ? await redeRepositorio.removerRecomendacao(slug)
        : await redeRepositorio.recomendarPerfil(slug);
      if (!resultado.ok) {
        setErro(resultado.mensagem);
        return;
      }
      setRecomendado(!recomendado);
      router.refresh();
    });
  }

  return (
    <Card className="flex flex-col gap-3">
      {estado.criador ? (
        <p className="text-sm text-muted">Você indicou este perfil, então não pode avaliá-lo. Pode recomendá-lo.</p>
      ) : (
        <Link href={`/minha-rede/avaliar/${slug}`}>
          <Button className="w-full">{estado.jaAvaliou ? "Editar minha avaliação" : "Avaliar este perfil"}</Button>
        </Link>
      )}
      <Button
        type="button"
        variante={recomendado ? "secondary" : "outline"}
        onClick={alternarRecomendacao}
        disabled={pendente}
        aria-pressed={recomendado}
      >
        {recomendado ? "Recomendado por você ✓" : "Recomendar"}
      </Button>
      {erro && (
        <p role="alert" className="text-xs text-danger">
          {erro}
        </p>
      )}
    </Card>
  );
}
