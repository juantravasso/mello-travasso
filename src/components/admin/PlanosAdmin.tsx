"use client";

import { useEffect, useState } from "react";
import type { MatrizPlanos, PlanoEmpresa } from "@/types";
import { planosAdminRepositorio as repo } from "@/services/data";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PainelConfirmacao } from "./PainelConfirmacao";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";

const ROTULO_PLANO: Record<PlanoEmpresa, string> = {
  gratuito: "Gratuito",
  teste: "Teste",
  cortesia: "Cortesia",
  ativo: "Ativo",
  suspenso: "Suspenso (assinatura inativa: somente leitura)",
};

/** Matriz plano × recurso. Só as chaves que já têm barreira no código aparecem; marcar ou desmarcar vale na próxima requisição de cada empresa. */
export function PlanosAdmin() {
  const [matriz, setMatriz] = useState<MatrizPlanos | null>(null);
  const [rascunho, setRascunho] = useState<Record<string, string[]>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<PlanoEmpresa | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function carregar() {
    const dados = await repo.obter();
    setMatriz(dados);
    setRascunho(Object.fromEntries(dados.planos.map((p) => [p.plano, p.recursos])));
  }

  useEffect(() => {
    carregar().catch((e) => setErro(mensagemDeErro(e)));
  }, []);

  function alternar(plano: PlanoEmpresa, chave: string) {
    setRascunho((atual) => {
      const lista = atual[plano] ?? [];
      return { ...atual, [plano]: lista.includes(chave) ? lista.filter((c) => c !== chave) : [...lista, chave] };
    });
  }

  async function salvar(plano: PlanoEmpresa, motivo: string, senha: string) {
    setOcupado(true);
    setErro(null);
    try {
      const resultado = await repo.salvarRecursos(plano, rascunho[plano] ?? [], motivo, senha);
      if (!resultado.ok) {
        setErro(resultado.mensagem);
        return;
      }
      setConfirmando(null);
      await carregar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  if (!matriz) {
    return erro ? (
      <p role="alert" className="rounded-lg border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
        {erro}
      </p>
    ) : (
      <Card className="h-24 animate-pulse bg-surface-2" aria-busy="true">
        {null}
      </Card>
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <p className="text-sm text-muted">
        Cada recurso tem uma barreira no servidor. Mudar um plano vale para todas as empresas nele, na próxima requisição. Os planos de teste,
        cortesia e ativo sempre mantêm rede e gestão, e o gratuito sempre mantém a rede. Para barrar uma conta inteira, use o bloqueio de
        empresa.
      </p>

      {erro && (
        <p role="alert" className="rounded-lg border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
          {erro}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {matriz.planos.map((p) => {
          const atual = [...(rascunho[p.plano] ?? [])].sort().join(",");
          const original = [...p.recursos].sort().join(",");
          const mudou = atual !== original;
          return (
            <li key={p.plano}>
              <Card className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-semibold text-foreground">{ROTULO_PLANO[p.plano]}</span>
                  <Badge tom="neutral">{`${p.empresas} ${p.empresas === 1 ? "empresa" : "empresas"}`}</Badge>
                </div>
                <fieldset className="flex flex-col gap-2">
                  <legend className="sr-only">Recursos do plano {ROTULO_PLANO[p.plano]}</legend>
                  {matriz.recursos.map((r) => (
                    <label key={r.chave} className="flex min-h-9 items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1 size-4 accent-[var(--color-primary)]"
                        checked={(rascunho[p.plano] ?? []).includes(r.chave)}
                        onChange={() => alternar(p.plano, r.chave)}
                      />
                      <span>
                        <span className="font-medium text-foreground">{r.nome}</span>
                        {r.descricao && <span className="block text-muted">{r.descricao}</span>}
                      </span>
                    </label>
                  ))}
                </fieldset>
                {mudou && confirmando !== p.plano && (
                  <div>
                    <Button type="button" tamanho="sm" onClick={() => setConfirmando(p.plano)}>
                      Salvar alterações
                    </Button>
                  </div>
                )}
                {confirmando === p.plano && (
                  <PainelConfirmacao
                    rotuloMotivo={`Motivo da mudança no plano ${ROTULO_PLANO[p.plano]} (fica registrado)`}
                    rotuloBotao="Confirmar mudança"
                    perigo
                    ocupado={ocupado}
                    aoConfirmar={(motivo, senha) => salvar(p.plano, motivo, senha)}
                    aoCancelar={() => setConfirmando(null)}
                  />
                )}
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
