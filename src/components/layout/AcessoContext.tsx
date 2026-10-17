"use client";

import { createContext, useContext, type ReactNode } from "react";
import { podeAcessarRota, temAlgumModulo, type AcessoDaPessoa, type ModuloChave } from "@/lib/auth/modulos";

// O que o usuário logado pode usar, vindo da sessão (servidor). Serve para esconder o que ele não acessa; quem
// protege de verdade são o layout das páginas e as Server Actions.

const SEM_ACESSO: AcessoDaPessoa = { papel: "membro", modulos: [] };
const Contexto = createContext<AcessoDaPessoa>(SEM_ACESSO);

export function AcessoProvider({ pessoa, children }: { pessoa: AcessoDaPessoa; children: ReactNode }) {
  return <Contexto.Provider value={pessoa}>{children}</Contexto.Provider>;
}

export function useAcesso() {
  const pessoa = useContext(Contexto);
  return {
    pessoa,
    pode: (...modulos: ModuloChave[]) => temAlgumModulo(pessoa, modulos),
    podeAbrir: (rota: string) => podeAcessarRota(pessoa, rota),
  };
}
