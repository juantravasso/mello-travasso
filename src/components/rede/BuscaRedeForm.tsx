"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import type { CategoriaItem, FiltrosBuscaPerfil } from "@/types";
import { UFS } from "@/lib/rede/ufs";
import { sugerirCidades } from "@/services/data/server/redeActions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

function montarQuery(f: FiltrosBuscaPerfil): string {
  const params = new URLSearchParams();
  if (f.q) params.set("q", f.q);
  if (f.profissao) params.set("profissao", f.profissao);
  if (f.categoria) params.set("categoria", f.categoria);
  if (f.estado) params.set("estado", f.estado);
  if (f.cidade) params.set("cidade", f.cidade);
  if (f.tipo) params.set("tipo", f.tipo);
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
  const [sugestoes, setSugestoes] = useState<string[]>([]);

  useEffect(() => {
    const termo = cidade.trim();
    if (termo.length < 2) {
      setSugestoes([]);
      return;
    }
    let cancelado = false;
    const espera = setTimeout(() => {
      sugerirCidades(estado || undefined, termo)
        .then((lista) => {
          if (!cancelado) setSugestoes(lista);
        })
        .catch(() => {
          if (!cancelado) setSugestoes([]);
        });
    }, 250);
    return () => {
      cancelado = true;
      clearTimeout(espera);
    };
  }, [cidade, estado]);

  function pesquisar(evento: React.FormEvent) {
    evento.preventDefault();
    router.push(
      `/rede/buscar${montarQuery({
        q: q.trim() || undefined,
        profissao: profissao || undefined,
        estado: estado || undefined,
        cidade: cidade.trim() || undefined,
        tipo: tipo === "pj" || tipo === "pf" ? tipo : undefined,
      })}`,
    );
  }

  const profissoes = taxonomia
    .flatMap((c) => c.profissoes)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return (
    <form onSubmit={pesquisar} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.4fr_1fr_1.4fr]" role="search">
      <Input
        id="rede-q"
        label="O que você procura?"
        placeholder="Nome ou serviço"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        maxLength={80}
      />
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
      <div className="flex flex-col">
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
      <Select id="rede-tipo" label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
        <option value="">Empresas e autônomos</option>
        <option value="pj">Só empresas</option>
        <option value="pf">Só autônomos</option>
      </Select>
      <div className="flex items-end sm:col-span-2 lg:col-span-3 lg:justify-end">
        <Button type="submit" className="w-full sm:w-auto sm:min-w-40">
          Pesquisar
        </Button>
      </div>
    </form>
  );
}
