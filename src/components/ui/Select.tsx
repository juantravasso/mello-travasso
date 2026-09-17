"use client";

import { Children, isValidElement, useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { animate } from "animejs";
import { cn } from "@/lib/cn";

interface SelectProps {
  label?: string;
  value: string;
  onChange: (evento: { target: { value: string } }) => void;
  children: ReactNode;
  id?: string;
  className?: string;
  disabled?: boolean;
}

interface OpcaoInterna {
  valor: string;
  rotulo: ReactNode;
  desabilitada: boolean;
}

function extrairOpcoes(children: ReactNode): OpcaoInterna[] {
  const opcoes: OpcaoInterna[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as { value?: string; children?: ReactNode; disabled?: boolean };
    opcoes.push({
      valor: props.value !== undefined ? String(props.value) : "",
      rotulo: props.children,
      desabilitada: !!props.disabled,
    });
  });
  return opcoes;
}

/**
 * Dropdown com visual próprio (não usa o <select> nativo do SO), para manter
 * a mesma identidade visual em qualquer navegador/plataforma. A API imita um
 * <select> comum (value/onChange/children com <option>) para não exigir
 * mudanças nos formulários que já usam este componente.
 */
export function Select({ label, value, onChange, children, id, className, disabled }: SelectProps) {
  const opcoes = extrairOpcoes(children);
  const selecionada = opcoes.find((o) => o.valor === String(value ?? ""));
  const ehPlaceholder = !selecionada || selecionada.desabilitada;

  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const idGerado = useId();
  const idFinal = id ?? idGerado;

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setAberto(false);
    }
    function aoTeclarEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclarEsc);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclarEsc);
    };
  }, [aberto]);

  useEffect(() => {
    if (aberto && menuRef.current) {
      animate(menuRef.current, {
        opacity: [0, 1],
        translateY: [-6, 0],
        duration: 150,
        ease: "outQuad",
      });
    }
  }, [aberto]);

  function selecionar(opcao: OpcaoInterna) {
    if (opcao.desabilitada) return;
    setAberto(false);
    onChange({ target: { value: opcao.valor } });
  }

  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm" htmlFor={idFinal}>
      {label && <span className="font-medium text-foreground">{label}</span>}
      <div ref={containerRef} className="relative">
        <button
          type="button"
          id={idFinal}
          disabled={disabled}
          onClick={() => setAberto((v) => !v)}
          className={cn(
            "flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 text-left text-base text-foreground outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <span className={cn("truncate", ehPlaceholder && "text-muted")}>{selecionada?.rotulo ?? ""}</span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className={cn("h-4 w-4 flex-shrink-0 text-muted transition-transform", aberto && "rotate-180")}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {aberto && (
          <div
            ref={menuRef}
            role="listbox"
            className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-60 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg"
          >
            {opcoes.map((opcao, indice) => (
              <button
                key={`${opcao.valor}-${indice}`}
                type="button"
                role="option"
                aria-selected={opcao.valor === selecionada?.valor}
                disabled={opcao.desabilitada}
                onClick={() => selecionar(opcao)}
                className={cn(
                  "flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors disabled:cursor-default disabled:text-muted",
                  !opcao.desabilitada && opcao.valor === selecionada?.valor
                    ? "bg-primary/15 text-primary"
                    : !opcao.desabilitada && "text-foreground hover:bg-surface-2",
                )}
              >
                {opcao.rotulo}
              </button>
            ))}
          </div>
        )}
      </div>
    </label>
  );
}
