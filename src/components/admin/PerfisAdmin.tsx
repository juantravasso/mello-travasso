"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { PerfilAdminItem } from "@/types";
import { perfisAdminRepositorio as repo } from "@/services/data";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

function mensagemDeErro(erro: unknown): string {
  return erro instanceof Error && erro.message && !erro.message.startsWith("NAO_") && erro.message !== "SEM_PERMISSAO"
    ? erro.message
    : "Não foi possível concluir agora. Tente de novo.";
}

export function PerfisAdmin() {
  const [busca, setBusca] = useState("");
  const [perfis, setPerfis] = useState<PerfilAdminItem[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [suspendendo, setSuspendendo] = useState<string | null>(null);
  const [reativando, setReativando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [senha, setSenha] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async (termo: string) => {
    setPerfis(await repo.listar(termo || undefined));
  }, []);

  useEffect(() => {
    carregar("").catch((e) => setErro(mensagemDeErro(e)));
  }, [carregar]);

  async function executar(acao: () => ReturnType<typeof repo.reativar>) {
    setOcupado(true);
    setErro(null);
    try {
      const resultado = await acao();
      if (!resultado.ok) {
        setErro(resultado.mensagem);
        return;
      }
      setSuspendendo(null);
      setReativando(null);
      setMotivo("");
      setSenha("");
      await carregar(busca);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          carregar(busca).catch((err) => setErro(mensagemDeErro(err)));
        }}
        className="flex items-end gap-2"
        role="search"
      >
        <div className="min-w-0 flex-1">
          <Input label="Buscar perfil por nome ou endereço" value={busca} onChange={(e) => setBusca(e.target.value)} maxLength={80} />
        </div>
        <Button type="submit" variante="outline">
          Buscar
        </Button>
      </form>

      {erro && (
        <p role="alert" className="rounded-lg border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
          {erro}
        </p>
      )}

      {!perfis ? (
        <Card className="h-24 animate-pulse bg-surface-2" aria-busy="true">
          {null}
        </Card>
      ) : perfis.length === 0 ? (
        <Card className="text-sm text-muted">Nenhum perfil publicado, indicado ou suspenso encontrado.</Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {perfis.map((perfil) => (
            <li key={perfil.slug}>
              <Card className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-semibold text-foreground">{perfil.nome}</span>
                  <Badge tom={perfil.status === "suspenso" ? "warning" : perfil.status === "indicado" ? "info" : "success"}>
                    {perfil.status === "suspenso" ? "Suspenso" : perfil.status === "indicado" ? "Indicado" : "Publicado"}
                  </Badge>
                  <Badge tom="neutral">{perfil.tipo === "pj" ? "Empresa" : "Autônomo"}</Badge>
                  <span className="text-sm text-muted">
                    {[perfil.cidade, perfil.estado].filter(Boolean).join("/") || "Sem localização"}
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    {(perfil.status === "publicado" || perfil.status === "indicado") && (
                      <Link href={`/empresas/${perfil.slug}`} className="text-sm font-medium text-primary underline underline-offset-4">
                        Ver página
                      </Link>
                    )}
                    {perfil.status === "suspenso" ? (
                      <Button type="button" tamanho="sm" variante="outline" disabled={ocupado} onClick={() => { setReativando(perfil.slug); setSenha(""); }}>
                        Reativar
                      </Button>
                    ) : (
                      <Button type="button" tamanho="sm" variante="danger" disabled={ocupado} onClick={() => { setSuspendendo(perfil.slug); setMotivo(""); setSenha(""); }}>
                        Suspender
                      </Button>
                    )}
                  </span>
                </div>

                {reativando === perfil.slug && (
                  <div className="flex flex-col gap-2 border-t border-border pt-3">
                    <Input
                      type="password"
                      label={`Confirme sua senha para reativar ${perfil.nome}`}
                      autoComplete="current-password"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      maxLength={200}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        tamanho="sm"
                        disabled={ocupado || senha.length === 0}
                        onClick={() => executar(() => repo.reativar(perfil.slug, senha))}
                      >
                        Confirmar reativação
                      </Button>
                      <Button type="button" tamanho="sm" variante="ghost" onClick={() => setReativando(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}

                {suspendendo === perfil.slug && (
                  <div className="flex flex-col gap-2 border-t border-border pt-3">
                    <Input
                      label={`Motivo da suspensão de ${perfil.nome} (fica registrado)`}
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      maxLength={500}
                      autoFocus
                    />
                    <Input
                      type="password"
                      label="Confirme sua senha"
                      autoComplete="current-password"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      maxLength={200}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        tamanho="sm"
                        variante="danger"
                        disabled={ocupado || motivo.trim().length < 5 || senha.length === 0}
                        onClick={() => executar(() => repo.suspender(perfil.slug, motivo, senha))}
                      >
                        Confirmar suspensão
                      </Button>
                      <Button type="button" tamanho="sm" variante="ghost" onClick={() => setSuspendendo(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
