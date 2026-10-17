"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import type { CategoriaItem, MeuPerfil, SalvarPerfilInput } from "@/types";
import { redeRepositorio } from "@/services/data";
import { UFS } from "@/lib/rede/ufs";
import { formatarTelefone } from "@/lib/rede/texto";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/cn";
import { useSugestoesCidade } from "./useSugestoesCidade";

const MAX_PROFISSOES = 8;
const MAX_AREAS = 20;

function paraFormulario(perfil: MeuPerfil): SalvarPerfilInput {
  return {
    nome: perfil.nome,
    nomeFantasia: perfil.nomeFantasia,
    descricao: perfil.descricao,
    estado: perfil.estado,
    cidade: perfil.cidade,
    regiao: perfil.regiao,
    areasAtendimento: perfil.areasAtendimento,
    telefone: perfil.telefone ? formatarTelefone(perfil.telefone) : undefined,
    telefonePublico: perfil.telefonePublico,
    whatsapp: perfil.whatsapp ? formatarTelefone(perfil.whatsapp) : undefined,
    whatsappPublico: perfil.whatsappPublico,
    instagram: perfil.instagram,
    site: perfil.site,
    profissaoIds: perfil.profissaoIds,
  };
}

function mensagemDeErro(erro: unknown): string {
  return erro instanceof Error && erro.message && !erro.message.startsWith("NAO_") ? erro.message : "Não foi possível concluir agora. Tente de novo.";
}

function CampoPublico({
  id,
  label,
  valor,
  aoMudarValor,
  publico,
  aoMudarPublico,
  placeholder,
}: {
  id: string;
  label: string;
  valor: string;
  aoMudarValor: (v: string) => void;
  publico: boolean;
  aoMudarPublico: (v: boolean) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Input id={id} label={label} value={valor} onChange={(e) => aoMudarValor(e.target.value)} placeholder={placeholder} inputMode="tel" maxLength={30} />
      <label className="flex items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={publico}
          disabled={valor.trim() === ""}
          onChange={(e) => aoMudarPublico(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        Mostrar no perfil público
      </label>
    </div>
  );
}

export function PerfilForm() {
  const [perfil, setPerfil] = useState<MeuPerfil | null>(null);
  const [form, setForm] = useState<SalvarPerfilInput | null>(null);
  const [taxonomia, setTaxonomia] = useState<CategoriaItem[]>([]);
  const [novaArea, setNovaArea] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [confirmandoPublicacao, setConfirmandoPublicacao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const idCidades = useId();
  const { sugestoes: sugestoesCidade, desconhecida: cidadeDesconhecida } = useSugestoesCidade(form?.estado, form?.cidade ?? "");

  useEffect(() => {
    let cancelado = false;
    Promise.all([redeRepositorio.obterMeuPerfil(), redeRepositorio.listarTaxonomia()])
      .then(([meu, arvore]) => {
        if (cancelado) return;
        if (!meu.ok) {
          setErroCarga(meu.mensagem);
          return;
        }
        setPerfil(meu.dados);
        setForm(paraFormulario(meu.dados));
        setTaxonomia(arvore);
      })
      .catch((e) => {
        if (!cancelado) setErroCarga(mensagemDeErro(e));
      });
    return () => {
      cancelado = true;
    };
  }, []);

  if (erroCarga) {
    return (
      <Card role="alert" className="border-danger bg-danger-bg text-sm text-danger">
        {erroCarga}
      </Card>
    );
  }
  if (!perfil || !form) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando perfil">
        <Card className="h-24 animate-pulse bg-surface-2">{null}</Card>
        <Card className="h-64 animate-pulse bg-surface-2">{null}</Card>
      </div>
    );
  }

  function atualizar<K extends keyof SalvarPerfilInput>(campo: K, valor: SalvarPerfilInput[K]) {
    setForm((atual) => (atual ? { ...atual, [campo]: valor } : atual));
    setAviso(null);
  }

  function alternarProfissao(id: string) {
    if (!form) return;
    const marcada = form.profissaoIds.includes(id);
    if (!marcada && form.profissaoIds.length >= MAX_PROFISSOES) {
      setErro(`Escolha no máximo ${MAX_PROFISSOES} profissões.`);
      return;
    }
    setErro(null);
    atualizar("profissaoIds", marcada ? form.profissaoIds.filter((p) => p !== id) : [...form.profissaoIds, id]);
  }

  function adicionarArea() {
    if (!form) return;
    const texto = novaArea.trim();
    if (!texto) return;
    if (form.areasAtendimento.length >= MAX_AREAS) {
      setErro(`No máximo ${MAX_AREAS} áreas de atendimento.`);
      return;
    }
    if (!form.areasAtendimento.includes(texto)) atualizar("areasAtendimento", [...form.areasAtendimento, texto]);
    setNovaArea("");
    setErro(null);
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!form) return;
    setSalvando(true);
    setErro(null);
    setAviso(null);
    try {
      const resultado = await redeRepositorio.salvarMeuPerfil(form);
      if (!resultado.ok) {
        setErro(resultado.mensagem);
        return;
      }
      setPerfil(resultado.dados);
      setForm(paraFormulario(resultado.dados));
      setAviso("Perfil salvo.");
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  async function alternarPublicacao() {
    if (!perfil) return;
    setPublicando(true);
    setErro(null);
    setAviso(null);
    try {
      const resultado = await redeRepositorio.definirPublicacao(perfil.status !== "publicado");
      if (!resultado.ok) {
        setErro(resultado.mensagem);
        return;
      }
      setPerfil(resultado.dados);
      setConfirmandoPublicacao(false);
      setAviso(resultado.dados.status === "publicado" ? "Perfil publicado." : "Perfil voltou para rascunho.");
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setPublicando(false);
    }
  }

  const raizes = taxonomia.filter((c) => !c.paiId);
  const grupos = raizes
    .map((raiz) => ({
      raiz,
      profissoes: [
        ...raiz.profissoes,
        ...taxonomia.filter((c) => c.paiId === raiz.id).flatMap((c) => c.profissoes),
      ],
    }))
    .filter((g) => g.profissoes.length > 0);

  return (
    <form onSubmit={salvar} className="flex flex-col gap-6" noValidate>
      <Card
        className={cn(
          "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
          perfil.status === "suspenso" && "border-warning bg-warning-bg",
        )}
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Badge tom={perfil.status === "publicado" ? "success" : perfil.status === "suspenso" ? "warning" : "neutral"}>
              {perfil.status === "publicado" ? "Publicado" : perfil.status === "suspenso" ? "Suspenso" : "Rascunho"}
            </Badge>
            {perfil.status === "publicado" && (
              <Link href={`/empresas/${perfil.slug}`} className="text-sm font-medium text-primary underline underline-offset-4">
                Ver perfil público
              </Link>
            )}
          </div>
          <p className="text-sm text-muted">
            {perfil.status === "publicado"
              ? `Qualquer pessoa pode ver este perfil em /empresas/${perfil.slug}.`
              : perfil.status === "suspenso"
                ? "A administração suspendeu este perfil. Entre em contato com o suporte."
                : "Ninguém além de você vê este perfil. Preencha os dados e publique quando estiver pronto."}
          </p>
        </div>
        {perfil.status !== "suspenso" && (
          <Button
            type="button"
            variante={perfil.status === "publicado" ? "outline" : "primary"}
            onClick={perfil.status === "publicado" ? alternarPublicacao : () => setConfirmandoPublicacao(true)}
            disabled={publicando || confirmandoPublicacao}
            aria-busy={publicando}
          >
            {perfil.status === "publicado" ? "Despublicar" : "Publicar perfil"}
          </Button>
        )}
      </Card>

      {confirmandoPublicacao && perfil.status !== "publicado" && (
        <Card role="alertdialog" aria-labelledby="titulo-confirmar-publicacao" className="flex flex-col gap-3 border-primary">
          <h2 id="titulo-confirmar-publicacao" className="text-base font-semibold text-foreground">
            Publicar este perfil?
          </h2>
          <p className="text-sm text-muted">
            Qualquer pessoa, mesmo sem conta, poderá ver estes dados, e buscadores como o Google podem listá-los:
          </p>
          <ul className="list-disc pl-5 text-sm text-foreground">
            <li>Nome no perfil, descrição, profissões, cidade, estado e áreas de atendimento.</li>
            <li>Instagram e site, se preenchidos.</li>
            <li>
              Telefone e WhatsApp, só se você marcou &quot;Mostrar no perfil público&quot;
              {perfil.telefonePublico || perfil.whatsappPublico ? " (marcado no perfil salvo)." : " (nenhum marcado no perfil salvo)."}
            </li>
          </ul>
          {perfil.tipo === "pf" && (
            <p className="text-sm text-warning">
              Como autônomo, o nome que está no campo &quot;Nome no perfil&quot; ficará público. Use um nome profissional se preferir não expor o nome completo.
            </p>
          )}
          <p className="text-xs text-muted">Você pode despublicar a qualquer momento; o perfil sai das buscas e a página deixa de abrir.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={alternarPublicacao} disabled={publicando} aria-busy={publicando}>
              {publicando ? "Publicando…" : "Sim, publicar"}
            </Button>
            <Button type="button" variante="ghost" onClick={() => setConfirmandoPublicacao(false)} disabled={publicando}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      <section className="flex flex-col gap-4" aria-labelledby="sec-identidade">
        <h2 id="sec-identidade" className="text-base font-semibold text-foreground">
          Identidade
        </h2>
        <Input id="perfil-nome" label="Nome no perfil" value={form.nome} onChange={(e) => atualizar("nome", e.target.value)} maxLength={120} required />
        {perfil.tipo === "pj" && (
          <Input
            id="perfil-fantasia"
            label="Nome fantasia (opcional)"
            value={form.nomeFantasia ?? ""}
            onChange={(e) => atualizar("nomeFantasia", e.target.value)}
            maxLength={120}
          />
        )}
        <Textarea
          id="perfil-descricao"
          label="Descrição"
          placeholder="O que você faz, há quanto tempo e que tipo de obra atende."
          value={form.descricao ?? ""}
          onChange={(e) => atualizar("descricao", e.target.value)}
          maxLength={2000}
          rows={5}
        />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="sec-profissoes">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="sec-profissoes" className="text-base font-semibold text-foreground">
            Profissões
          </h2>
          <span className="text-xs text-muted tabular-nums">
            {form.profissaoIds.length}/{MAX_PROFISSOES}
          </span>
        </div>
        {grupos.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma profissão cadastrada ainda. A administração precisa criá-las primeiro.</p>
        ) : (
          grupos.map(({ raiz, profissoes }) => (
            <fieldset key={raiz.id} className="flex flex-col gap-2">
              <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{raiz.nome}</legend>
              <div className="flex flex-wrap gap-2">
                {profissoes.map((p) => {
                  const marcada = form.profissaoIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={marcada}
                      onClick={() => alternarProfissao(p.id)}
                      className={cn(
                        "h-9 rounded-full border px-3 text-sm font-medium transition-colors",
                        marcada
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border text-foreground hover:bg-surface-2",
                      )}
                    >
                      {p.nome}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))
        )}
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="sec-local">
        <h2 id="sec-local" className="text-base font-semibold text-foreground">
          Onde atende
        </h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
          <Select id="perfil-estado" label="Estado" value={form.estado ?? ""} onChange={(e) => atualizar("estado", e.target.value || undefined)}>
            <option value="">Selecione</option>
            {UFS.map((uf) => (
              <option key={uf.sigla} value={uf.sigla}>
                {uf.sigla} — {uf.nome}
              </option>
            ))}
          </Select>
          <div className="flex flex-col gap-1">
            <Input
              id="perfil-cidade"
              label="Cidade"
              value={form.cidade ?? ""}
              onChange={(e) => atualizar("cidade", e.target.value)}
              list={idCidades}
              maxLength={100}
              autoComplete="off"
              aria-describedby={cidadeDesconhecida ? "perfil-cidade-aviso" : undefined}
            />
            <datalist id={idCidades}>
              {sugestoesCidade.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            {cidadeDesconhecida && (
              <p id="perfil-cidade-aviso" role="status" className="text-xs text-warning">
                Não achamos essa cidade{form.estado ? ` em ${form.estado}` : ""}. Escolha uma da lista para aparecer na busca por distância e nas
                páginas da sua cidade.
              </p>
            )}
          </div>
        </div>
        <Input
          id="perfil-regiao"
          label="Região (opcional)"
          placeholder="Ex.: Baixada Fluminense"
          value={form.regiao ?? ""}
          onChange={(e) => atualizar("regiao", e.target.value)}
          maxLength={100}
        />
        <div className="flex flex-col gap-2">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Input
                id="perfil-area"
                label="Bairros ou cidades atendidas (opcional)"
                value={novaArea}
                onChange={(e) => setNovaArea(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    adicionarArea();
                  }
                }}
                maxLength={80}
              />
            </div>
            <Button type="button" variante="outline" onClick={adicionarArea}>
              Adicionar
            </Button>
          </div>
          {form.areasAtendimento.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {form.areasAtendimento.map((area) => (
                <li key={area} className="flex items-center gap-1 rounded-md bg-surface-2 py-1 pl-2.5 pr-1 text-sm text-foreground">
                  {area}
                  <button
                    type="button"
                    aria-label={`Remover ${area}`}
                    onClick={() => atualizar("areasAtendimento", form.areasAtendimento.filter((a) => a !== area))}
                    className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-border hover:text-foreground"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="sec-contato">
        <div className="flex flex-col gap-1">
          <h2 id="sec-contato" className="text-base font-semibold text-foreground">
            Contato
          </h2>
          <p className="text-xs text-muted">
            Telefone e WhatsApp só aparecem no perfil público se você marcar. Instagram e site, quando preenchidos, são sempre públicos.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoPublico
            id="perfil-telefone"
            label="Telefone"
            placeholder="(21) 3333-4444"
            valor={form.telefone ?? ""}
            aoMudarValor={(v) => atualizar("telefone", v)}
            publico={form.telefonePublico}
            aoMudarPublico={(v) => atualizar("telefonePublico", v)}
          />
          <CampoPublico
            id="perfil-whatsapp"
            label="WhatsApp"
            placeholder="(21) 99999-8888"
            valor={form.whatsapp ?? ""}
            aoMudarValor={(v) => atualizar("whatsapp", v)}
            publico={form.whatsappPublico}
            aoMudarPublico={(v) => atualizar("whatsappPublico", v)}
          />
          <Input id="perfil-instagram" label="Instagram" placeholder="@usuario" value={form.instagram ?? ""} onChange={(e) => atualizar("instagram", e.target.value)} maxLength={120} />
          <Input id="perfil-site" label="Site" placeholder="www.seusite.com.br" value={form.site ?? ""} onChange={(e) => atualizar("site", e.target.value)} maxLength={200} inputMode="url" />
        </div>
      </section>

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

      <div className="flex">
        <Button type="submit" disabled={salvando} aria-busy={salvando} className="w-full sm:w-auto sm:min-w-40">
          {salvando ? "Salvando…" : "Salvar perfil"}
        </Button>
      </div>
    </form>
  );
}
