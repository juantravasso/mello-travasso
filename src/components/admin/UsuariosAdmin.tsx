"use client";

import { useCallback, useEffect, useState } from "react";
import type { ResultadoAction, UsuarioAdminItem } from "@/types";
import { usuariosAdminRepositorio as repo } from "@/services/data";
import { formatarDataBr } from "@/lib/rede/texto";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PainelConfirmacao } from "./PainelConfirmacao";

type Painel = { tipo: "bloquear" | "desbloquear" | "sessoes"; usuarioId: string } | null;

function mensagemDeErro(erro: unknown): string {
  return erro instanceof Error && erro.message && !erro.message.startsWith("NAO_") && erro.message !== "SEM_PERMISSAO"
    ? erro.message
    : "Não foi possível concluir agora. Tente de novo.";
}

export function UsuariosAdmin() {
  const [busca, setBusca] = useState("");
  const [usuarios, setUsuarios] = useState<UsuarioAdminItem[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [painel, setPainel] = useState<Painel>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async (termo: string) => {
    setUsuarios(await repo.listar(termo || undefined));
  }, []);

  useEffect(() => {
    carregar("").catch((e) => setErro(mensagemDeErro(e)));
  }, [carregar]);

  async function executar(acao: () => Promise<ResultadoAction<null>>) {
    setOcupado(true);
    setErro(null);
    try {
      const resultado = await acao();
      if (!resultado.ok) {
        setErro(resultado.mensagem);
        return;
      }
      setPainel(null);
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
          <Input label="Buscar por nome ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} maxLength={80} />
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

      {!usuarios ? (
        <Card className="h-24 animate-pulse bg-surface-2" aria-busy="true">
          {null}
        </Card>
      ) : usuarios.length === 0 ? (
        <Card className="text-sm text-muted">Nenhum usuário encontrado.</Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {usuarios.map((u) => {
            const aberto = painel?.usuarioId === u.id ? painel.tipo : null;
            return (
              <li key={u.id}>
                <Card className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-semibold text-foreground">{u.nome}</span>
                    <Badge tom="neutral">{u.papel === "dono" ? "Dono" : "Membro"}</Badge>
                    {u.admin && <Badge tom="info">Administrador</Badge>}
                    {u.bloqueadoEm && <Badge tom="danger">Bloqueado</Badge>}
                    {u.empresaBloqueada && <Badge tom="danger">Empresa bloqueada</Badge>}
                    <Badge tom={u.emailConfirmado ? "success" : "warning"}>{u.emailConfirmado ? "E-mail confirmado" : "E-mail não confirmado"}</Badge>
                    {u.proprio && <Badge tom="neutral">Você</Badge>}
                  </div>
                  <p className="break-all text-sm text-foreground/90">{u.email}</p>
                  <p className="text-sm text-muted">
                    {u.empresaNome} · cadastro em {formatarDataBr(u.criadoEm)}
                  </p>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button type="button" tamanho="sm" variante="outline" disabled={ocupado} onClick={() => setPainel({ tipo: "sessoes", usuarioId: u.id })}>
                      Encerrar sessões
                    </Button>
                    {u.bloqueadoEm ? (
                      <Button type="button" tamanho="sm" variante="outline" disabled={ocupado} onClick={() => setPainel({ tipo: "desbloquear", usuarioId: u.id })}>
                        Desbloquear
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        tamanho="sm"
                        variante="danger"
                        disabled={ocupado || u.proprio || u.admin}
                        title={u.proprio ? "Você não pode bloquear a si mesmo." : u.admin ? "Administrador da plataforma." : undefined}
                        onClick={() => setPainel({ tipo: "bloquear", usuarioId: u.id })}
                      >
                        Bloquear
                      </Button>
                    )}
                  </div>

                  {aberto === "bloquear" && (
                    <PainelConfirmacao
                      rotuloMotivo={`Motivo do bloqueio de ${u.nome} (interno, o usuário não vê)`}
                      rotuloBotao="Confirmar bloqueio"
                      perigo
                      ocupado={ocupado}
                      aoConfirmar={(motivo, senha) => executar(() => repo.bloquear(u.id, motivo, senha))}
                      aoCancelar={() => setPainel(null)}
                    />
                  )}
                  {aberto === "desbloquear" && (
                    <PainelConfirmacao
                      rotuloBotao="Confirmar desbloqueio"
                      ocupado={ocupado}
                      aoConfirmar={(_motivo, senha) => executar(() => repo.desbloquear(u.id, senha))}
                      aoCancelar={() => setPainel(null)}
                    />
                  )}
                  {aberto === "sessoes" && (
                    <PainelConfirmacao
                      rotuloBotao="Encerrar todas as sessões"
                      ocupado={ocupado}
                      aoConfirmar={(_motivo, senha) => executar(() => repo.encerrarSessoes(u.id, senha))}
                      aoCancelar={() => setPainel(null)}
                    />
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
