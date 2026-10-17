"use client";

import { MODULOS, type ModuloChave } from "@/lib/auth/modulos";
import { Button } from "@/components/ui/Button";

/** Escolha dos módulos que uma pessoa poderá usar. Só aparecem os que o plano da empresa permite. */
export function SeletorModulos({
  disponiveis,
  selecionados,
  aoMudar,
  desabilitado = false,
}: {
  disponiveis: readonly ModuloChave[];
  selecionados: readonly ModuloChave[];
  aoMudar: (modulos: ModuloChave[]) => void;
  desabilitado?: boolean;
}) {
  const lista = MODULOS.filter((m) => disponiveis.includes(m.chave));
  const gestao = lista.filter((m) => m.recurso === "gestao");
  const rede = lista.filter((m) => m.recurso === "rede");

  function alternar(chave: ModuloChave) {
    aoMudar(selecionados.includes(chave) ? selecionados.filter((s) => s !== chave) : [...selecionados, chave]);
  }

  function grupo(titulo: string, itens: typeof lista) {
    if (itens.length === 0) return null;
    return (
      <div className="flex flex-col">
        <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">{titulo}</p>
        <ul className="flex flex-col rounded-lg border border-border">
          {itens.map((m) => (
            <li key={m.chave} className="border-b border-border last:border-0">
              <label className="flex min-h-11 cursor-pointer items-start gap-3 px-3 py-2 text-sm hover:bg-surface-2">
                <input
                  type="checkbox"
                  checked={selecionados.includes(m.chave)}
                  disabled={desabilitado}
                  onChange={() => alternar(m.chave)}
                  className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[var(--color-primary)]"
                />
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">{m.rotulo}</span>
                  <span className="block text-xs text-muted">{m.descricao}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <fieldset className="flex flex-col gap-2" disabled={desabilitado}>
      <legend className="text-sm font-medium text-foreground">Módulos que a pessoa pode usar</legend>
      <div className="flex gap-2">
        <Button type="button" tamanho="sm" variante="ghost" onClick={() => aoMudar([...disponiveis])}>
          Marcar todos
        </Button>
        <Button type="button" tamanho="sm" variante="ghost" onClick={() => aoMudar([])}>
          Limpar
        </Button>
      </div>
      {grupo("Elo Gestão", gestao)}
      {grupo("Elo Profissionais", rede)}
      <p className="text-xs text-muted">
        {selecionados.length === 0 ? "Escolha ao menos um módulo." : `${selecionados.length} de ${disponiveis.length} módulos liberados.`} Configurações é de todos.
      </p>
    </fieldset>
  );
}
