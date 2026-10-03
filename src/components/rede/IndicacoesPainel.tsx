"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { CategoriaItem, IndicacaoItem } from "@/types";
import { redeRepositorio } from "@/services/data";
import { UFS } from "@/lib/rede/ufs";
import { formatarDataBr } from "@/lib/rede/texto";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

function FormularioIndicar({ taxonomia, aoIndicar }: { taxonomia: CategoriaItem[]; aoIndicar: () => Promise<void> }) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"pj" | "pf">("pj");
  const [profissaoId, setProfissaoId] = useState("");
  const [estado, setEstado] = useState("");
  const [cidade, setCidade] = useState("");
  const [documento, setDocumento] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ slug: string; jaExistia: boolean; nome: string } | null>(null);

  const profissoes = taxonomia.flatMap((c) => c.profissoes).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setErro(null);
    setResultado(null);
    try {
      const r = await redeRepositorio.indicarEmpresa({
        nome,
        tipo,
        profissaoId,
        estado,
        cidade,
        documento: tipo === "pj" && documento.trim() ? documento : undefined,
      });
      if (!r.ok) {
        setErro(r.mensagem);
        return;
      }
      setResultado({ ...r.dados, nome });
      setNome("");
      setDocumento("");
      await aoIndicar();
    } catch {
      setErro("Não foi possível indicar agora. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-foreground">Indicar uma empresa ou profissional</h2>
        <p className="text-sm text-muted">
          Quem você contratou ainda não está na rede? Crie uma página básica para ele. Ela mostra só nome, profissão e
          cidade — sem telefone ou outros contatos — até que ele crie a própria conta.
        </p>
      </div>

      <form onSubmit={enviar} className="grid gap-3 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2">
          <Input id="ind-nome" label="Nome da empresa ou do profissional" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} required />
        </div>
        <Select id="ind-tipo" label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value === "pf" ? "pf" : "pj")}>
          <option value="pj">Empresa</option>
          <option value="pf">Profissional autônomo</option>
        </Select>
        <Select id="ind-profissao" label="Profissão" value={profissaoId} onChange={(e) => setProfissaoId(e.target.value)}>
          <option value="" disabled>
            Escolha
          </option>
          {profissoes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </Select>
        <Select id="ind-estado" label="Estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="" disabled>
            Escolha
          </option>
          {UFS.map((uf) => (
            <option key={uf.sigla} value={uf.sigla}>
              {uf.sigla} — {uf.nome}
            </option>
          ))}
        </Select>
        <Input id="ind-cidade" label="Cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} maxLength={100} required />
        {tipo === "pj" && (
          <div className="sm:col-span-2">
            <Input
              id="ind-documento"
              label="CNPJ (opcional, evita duplicar uma empresa já indicada)"
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              maxLength={30}
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
            />
          </div>
        )}

        {erro && (
          <p role="alert" className="rounded-lg border border-danger bg-danger-bg px-3 py-2 text-sm text-danger sm:col-span-2">
            {erro}
          </p>
        )}
        {resultado && (
          <p role="status" className="rounded-lg border border-success bg-success-bg px-3 py-2 text-sm text-success sm:col-span-2">
            {resultado.jaExistia
              ? "Esse perfil já existe na rede, e sua recomendação foi registrada. "
              : `${resultado.nome} foi indicado. `}
            <Link href={`/empresas/${resultado.slug}`} className="font-medium underline underline-offset-4">
              Ver página
            </Link>
          </p>
        )}

        <div className="sm:col-span-2">
          <Button type="submit" disabled={enviando || !profissaoId || !estado || nome.trim().length < 2 || cidade.trim().length < 2} aria-busy={enviando}>
            {enviando ? "Indicando…" : "Indicar"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function IndicacoesPainel() {
  const [itens, setItens] = useState<IndicacaoItem[] | null>(null);
  const [taxonomia, setTaxonomia] = useState<CategoriaItem[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setItens(await redeRepositorio.listarMinhasIndicacoes());
  }, []);

  useEffect(() => {
    Promise.all([carregar(), redeRepositorio.listarTaxonomia().then(setTaxonomia)]).catch(() =>
      setErro("Não foi possível carregar agora. Tente de novo."),
    );
  }, [carregar]);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <FormularioIndicar taxonomia={taxonomia} aoIndicar={carregar} />

      <section className="flex flex-col gap-3" aria-labelledby="titulo-minhas-indicacoes">
        <h2 id="titulo-minhas-indicacoes" className="text-base font-semibold text-foreground">
          Minhas indicações e recomendações
        </h2>
        {erro ? (
          <Card role="alert" className="border-danger bg-danger-bg text-sm text-danger">
            {erro}
          </Card>
        ) : !itens ? (
          <Card className="h-20 animate-pulse bg-surface-2" aria-busy="true">
            {null}
          </Card>
        ) : itens.length === 0 ? (
          <Card className="text-sm text-muted">Você ainda não recomendou ninguém. Use o botão &quot;Recomendar&quot; na página de um perfil.</Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {itens.map((i) => (
              <li key={i.perfilSlug}>
                <Link href={`/empresas/${i.perfilSlug}`}>
                  <Card className="flex flex-wrap items-center gap-x-3 gap-y-1 transition-colors hover:border-primary/60 hover:bg-surface-2">
                    <span className="font-medium text-foreground">{i.perfilNome}</span>
                    {i.perfilIndicado && <Badge tom="info">Indicada pela rede</Badge>}
                    <span className="text-sm text-muted">{[i.cidade, i.estado].filter(Boolean).join("/")}</span>
                    <span className="ml-auto text-xs text-muted">{formatarDataBr(i.criadoEm)}</span>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
