"use client";

import { useCallback, useEffect, useState } from "react";
import type { CategoriaItem, ProfissaoItem, ResultadoAction } from "@/types";
import { taxonomiaAdminRepositorio as repo } from "@/services/data";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

function mensagemDeErro(erro: unknown): string {
  return erro instanceof Error && erro.message && !erro.message.startsWith("NAO_") && erro.message !== "SEM_PERMISSAO"
    ? erro.message
    : "Não foi possível concluir agora. Tente de novo.";
}

/** Linha com nome, edição inline e ações. A exclusão pede um segundo clique. */
function Linha({
  nome,
  ativo,
  rotuloInativo,
  negrito,
  aoRenomear,
  aoAlternarAtivo,
  aoExcluir,
  rotuloExcluir,
}: {
  nome: string;
  ativo: boolean;
  rotuloInativo: string;
  negrito?: boolean;
  aoRenomear: (novoNome: string) => Promise<void>;
  aoAlternarAtivo: () => Promise<void>;
  aoExcluir: () => Promise<void>;
  rotuloExcluir: string;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(nome);
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  async function executar(acao: () => Promise<void>) {
    setOcupado(true);
    try {
      await acao();
    } finally {
      setOcupado(false);
      setConfirmando(false);
    }
  }

  if (editando) {
    return (
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Input label={`Novo nome para ${nome}`} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={80} autoFocus />
        </div>
        <Button
          type="button"
          tamanho="sm"
          disabled={ocupado || texto.trim().length < 2}
          onClick={() => executar(async () => { await aoRenomear(texto); setEditando(false); })}
        >
          Salvar
        </Button>
        <Button type="button" tamanho="sm" variante="ghost" onClick={() => { setEditando(false); setTexto(nome); }}>
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className={negrito ? "font-semibold text-foreground" : "text-foreground"}>{nome}</span>
      {!ativo && <Badge tom="warning">{rotuloInativo}</Badge>}
      <span className="ml-auto flex flex-wrap items-center gap-1">
        <Button type="button" tamanho="sm" variante="ghost" disabled={ocupado} onClick={() => { setTexto(nome); setEditando(true); }}>
          Renomear
        </Button>
        <Button type="button" tamanho="sm" variante="ghost" disabled={ocupado} onClick={() => executar(aoAlternarAtivo)}>
          {ativo ? "Desativar" : "Reativar"}
        </Button>
        {confirmando ? (
          <Button type="button" tamanho="sm" variante="danger" disabled={ocupado} onClick={() => executar(aoExcluir)}>
            Confirmar exclusão
          </Button>
        ) : (
          <Button type="button" tamanho="sm" variante="ghost" disabled={ocupado} onClick={() => setConfirmando(true)} aria-label={rotuloExcluir}>
            Excluir
          </Button>
        )}
      </span>
    </div>
  );
}

function NovoItem({
  rotulo,
  botao,
  aoCriar,
}: {
  rotulo: string;
  botao: string;
  aoCriar: (nome: string) => Promise<void>;
}) {
  const [nome, setNome] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (nome.trim().length < 2) return;
    setOcupado(true);
    try {
      await aoCriar(nome.trim());
      setNome("");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex items-end gap-2">
      <div className="min-w-0 flex-1">
        <Input label={rotulo} value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} />
      </div>
      <Button type="submit" tamanho="sm" variante="outline" disabled={ocupado || nome.trim().length < 2} className="h-11">
        {botao}
      </Button>
    </form>
  );
}

export function TaxonomiaAdmin() {
  const [arvore, setArvore] = useState<CategoriaItem[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setArvore(await repo.listar());
  }, []);

  useEffect(() => {
    recarregar().catch((e) => setErro(mensagemDeErro(e)));
  }, [recarregar]);

  /** Roda a ação, recarrega a árvore e mostra o erro (sem derrubar a tela). */
  async function comRecarga(acao: () => Promise<ResultadoAction<null>>) {
    setErro(null);
    try {
      const resultado = await acao();
      if (!resultado.ok) {
        setErro(resultado.mensagem);
        return;
      }
      await recarregar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  if (!arvore) {
    return erro ? (
      <Card role="alert" className="border-danger bg-danger-bg text-sm text-danger">
        {erro}
      </Card>
    ) : (
      <Card className="h-40 animate-pulse bg-surface-2" aria-busy="true">
        {null}
      </Card>
    );
  }

  const raizes = arvore.filter((c) => !c.paiId);
  const filhasDe = (id: string) => arvore.filter((c) => c.paiId === id);

  function renderProfissao(p: ProfissaoItem) {
    return (
      <li key={p.id} className="border-t border-border py-2 pl-3 first:border-t-0">
        <Linha
          nome={p.nome}
          ativo={p.ativo}
          rotuloInativo="Inativa"
          aoRenomear={(nome) => comRecarga(() => repo.atualizarProfissao(p.id, { nome }))}
          aoAlternarAtivo={() => comRecarga(() => repo.atualizarProfissao(p.id, { ativo: !p.ativo }))}
          aoExcluir={() => comRecarga(() => repo.excluirProfissao(p.id))}
          rotuloExcluir={`Excluir profissão ${p.nome}`}
        />
      </li>
    );
  }

  function renderCategoria(c: CategoriaItem, nivel: 0 | 1) {
    return (
      <Card key={c.id} className={nivel === 1 ? "flex flex-col gap-3 bg-surface" : "flex flex-col gap-3"}>
        <Linha
          nome={c.nome}
          ativo={c.ativo}
          rotuloInativo="Inativa"
          negrito
          aoRenomear={(nome) => comRecarga(() => repo.atualizarCategoria(c.id, { nome }))}
          aoAlternarAtivo={() => comRecarga(() => repo.atualizarCategoria(c.id, { ativo: !c.ativo }))}
          aoExcluir={() => comRecarga(() => repo.excluirCategoria(c.id))}
          rotuloExcluir={`Excluir categoria ${c.nome}`}
        />
        {c.profissoes.length > 0 && <ul>{c.profissoes.map(renderProfissao)}</ul>}
        <NovoItem
          rotulo={`Nova profissão em ${c.nome}`}
          botao="Adicionar"
          aoCriar={(nome) => comRecarga(() => repo.criarProfissao({ nome, categoriaId: c.id }))}
        />
        {nivel === 0 && (
          <>
            {filhasDe(c.id).map((filha) => renderCategoria(filha, 1))}
            <NovoItem
              rotulo={`Nova subcategoria em ${c.nome}`}
              botao="Adicionar"
              aoCriar={(nome) => comRecarga(() => repo.criarCategoria({ nome, paiId: c.id }))}
            />
          </>
        )}
      </Card>
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {erro && (
        <p role="alert" className="rounded-lg border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
          {erro}
        </p>
      )}
      <Card>
        <NovoItem rotulo="Nova categoria" botao="Criar categoria" aoCriar={(nome) => comRecarga(() => repo.criarCategoria({ nome }))} />
      </Card>
      {raizes.length === 0 ? (
        <Card className="text-sm text-muted">Nenhuma categoria ainda. Crie a primeira acima.</Card>
      ) : (
        raizes.map((c) => renderCategoria(c, 0))
      )}
    </div>
  );
}
