"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import type { CategoriaItem, FiltrosBuscaPerfil } from "@/types";
import { UFS } from "@/lib/rede/ufs";
import { RAIOS_KM } from "@/lib/rede/raios";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useSugestoesCidade } from "./useSugestoesCidade";

function montarQuery(f: FiltrosBuscaPerfil): string {
  const params = new URLSearchParams();
  if (f.q) params.set("q", f.q);
  if (f.profissao) params.set("profissao", f.profissao);
  if (f.categoria) params.set("categoria", f.categoria);
  if (f.estado) params.set("estado", f.estado);
  if (f.cidade) params.set("cidade", f.cidade);
  if (f.tipo) params.set("tipo", f.tipo);
  if (f.notaMin) params.set("notaMin", String(f.notaMin));
  if (f.raioKm) params.set("raioKm", String(f.raioKm));
  const texto = params.toString();
  return texto ? `?${texto}` : "";
}

export function BuscaRedeForm({
  taxonomia,
  inicial = {},
}: {
  taxonomia: CategoriaItem[];
  inicial?: FiltrosBuscaPerfil;
}) {
  const router = useRouter();
  const idCidades = useId();
  const [q, setQ] = useState(inicial.q ?? "");
  const [profissao, setProfissao] = useState(inicial.profissao ?? "");
  const [estado, setEstado] = useState(inicial.estado ?? "");
  const [cidade, setCidade] = useState(inicial.cidade ?? "");
  const [tipo, setTipo] = useState<string>(inicial.tipo ?? "");
  const [notaMin, setNotaMin] = useState<string>(inicial.notaMin ? String(inicial.notaMin) : "");
  const [raio, setRaio] = useState<string>(inicial.raioKm ? String(inicial.raioKm) : "");
  const { sugestoes } = useSugestoesCidade(estado || undefined, cidade);

  function pesquisar(evento: React.FormEvent) {
    evento.preventDefault();
    router.push(
      `/rede/buscar${montarQuery({
        q: q.trim() || undefined,
        profissao: profissao || undefined,
        estado: estado || undefined,
        cidade: cidade.trim() || undefined,
        tipo: tipo === "pj" || tipo === "pf" ? tipo : undefined,
        notaMin: notaMin ? Number(notaMin) : undefined,
        // Raio só faz sentido com estado e cidade: sem eles não há centro para medir.
        raioKm: raio && estado && cidade.trim() ? Number(raio) : undefined,
      })}`,
    );
  }

  const profissoes = taxonomia
    .flatMap((c) => c.profissoes)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const filtrosExtrasAtivos = Boolean(inicial.profissao || inicial.estado || inicial.cidade || inicial.tipo || inicial.notaMin || inicial.raioKm);

  return (
    <form onSubmit={pesquisar} className="flex flex-col gap-3" role="search">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
        <Input id="rede-q" label="O que você procura?" placeholder="Nome ou serviço" value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} />
        <Button type="submit" className="h-11">
          Pesquisar
        </Button>
      </div>
      <details open={filtrosExtrasAtivos} className="group rounded-lg border border-border bg-surface">
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-medium text-foreground">
          Filtrar por profissão, local e avaliação
          <span aria-hidden className="text-muted transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <div className="grid grid-cols-2 gap-3 border-t border-border p-3 lg:grid-cols-4">
          <Select id="rede-profissao" label="Profissão" value={profissao} onChange={(e) => setProfissao(e.target.value)}>
            <option value="">Todas</option>
            {profissoes.map((p) => (
              <option key={p.id} value={p.slug}>
                {p.nome}
              </option>
            ))}
          </Select>
          <Select id="rede-estado" label="Estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos</option>
            {UFS.map((uf) => (
              <option key={uf.sigla} value={uf.sigla}>
                {uf.sigla}
              </option>
            ))}
          </Select>
          <div className="col-span-2 flex flex-col lg:col-span-1">
            <Input
              id="rede-cidade"
              label="Cidade"
              placeholder="Ex.: Duque de Caxias"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              list={idCidades}
              maxLength={100}
              autoComplete="off"
            />
            <datalist id={idCidades}>
              {sugestoes.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <Select id="rede-raio" label="Distância" value={raio} onChange={(e) => setRaio(e.target.value)} disabled={!estado || !cidade.trim()}>
            <option value="">Só nesta cidade</option>
            {RAIOS_KM.map((km) => (
              <option key={km} value={km}>
                Até {km} km
              </option>
            ))}
          </Select>
          <Select id="rede-tipo" label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Empresas e autônomos</option>
            <option value="pj">Só empresas</option>
            <option value="pf">Só autônomos</option>
          </Select>
          <Select id="rede-nota" label="Avaliação" value={notaMin} onChange={(e) => setNotaMin(e.target.value)}>
            <option value="">Qualquer nota</option>
            <option value="3">3 estrelas ou mais</option>
            <option value="4">4 estrelas ou mais</option>
            <option value="4.5">4,5 estrelas ou mais</option>
          </Select>
        </div>
      </details>
    </form>
  );
}
