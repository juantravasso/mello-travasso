"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PLANOS_ATRIBUIVEIS, type EmpresaAdminItem, type PlanoEmpresa, type ResultadoAction } from "@/types";
import { empresasAdminRepositorio as repo } from "@/services/data";
import { formatarDataBr } from "@/lib/rede/texto";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { definirPlanoComercialDaEmpresa, obterPlanosAdmin } from "@/services/data/server/planosComerciaisActions";
import type { PlanoComercialAdmin } from "@/types";
import { PainelConfirmacao } from "./PainelConfirmacao";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";

const ROTULO_PLANO: Record<PlanoEmpresa, string> = {
  gratuito: "Gratuito (só a rede)",
  teste: "Teste",
  cortesia: "Cortesia",
  ativo: "Ativo",
  suspenso: "Suspenso (legado)",
};

type Painel = { tipo: "bloquear" | "desbloquear" | "plano" | "comercial"; empresaId: string } | null;

export function EmpresasAdmin() {
  const [busca, setBusca] = useState("");
  const [empresas, setEmpresas] = useState<EmpresaAdminItem[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [painel, setPainel] = useState<Painel>(null);
  const [planoEscolhido, setPlanoEscolhido] = useState<string>("ativo");
  const [ocupado, setOcupado] = useState(false);
  const [comerciais, setComerciais] = useState<PlanoComercialAdmin[]>([]);
  const [comercialEscolhido, setComercialEscolhido] = useState<string>("");

  const carregar = useCallback(async (termo: string) => {
    setEmpresas(await repo.listar(termo || undefined));
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
          <Input label="Buscar por nome, CNPJ ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} maxLength={80} />
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

      {!empresas ? (
        <Card className="h-24 animate-pulse bg-surface-2" aria-busy="true">
          {null}
        </Card>
      ) : empresas.length === 0 ? (
        <Card className="text-sm text-muted">Nenhuma empresa encontrada.</Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {empresas.map((e) => {
            const aberto = painel?.empresaId === e.id ? painel.tipo : null;
            return (
              <li key={e.id}>
                <Card className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-semibold text-foreground">{e.nome}</span>
                    <Badge tom="neutral">{e.tipo === "pj" ? "Empresa" : "Autônomo"}</Badge>
                    <Badge tom={e.plano === "ativo" || e.plano === "cortesia" ? "success" : e.plano === "suspenso" ? "warning" : "info"}>
                      {`${ROTULO_PLANO[e.plano]}${e.planoComercial ? ` · ${e.planoComercial}` : ""}`}
                    </Badge>
                    {e.bloqueadaEm && <Badge tom="danger">Bloqueada</Badge>}
                    {e.propria && <Badge tom="neutral">Sua empresa</Badge>}
                  </div>
                  <p className="text-sm text-muted tabular-nums">
                    {e.documento} · criada em {formatarDataBr(e.criadoEm)}
                    {e.testeTerminaEm && <> · teste até {formatarDataBr(e.testeTerminaEm)}</>}
                  </p>
                  <p className="break-all text-sm text-foreground/90">{e.usuarios.map((u) => u.email).join(", ") || "Sem usuários"}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {e.perfilSlug && (
                      <Link href={`/empresas/${e.perfilSlug}`} className="text-sm font-medium text-primary underline underline-offset-4">
                        Perfil ({e.perfilStatus})
                      </Link>
                    )}
                    <span className="ml-auto flex flex-wrap items-center gap-2">
                      <Button type="button" tamanho="sm" variante="outline" disabled={ocupado} onClick={() => { setPainel({ tipo: "plano", empresaId: e.id }); setPlanoEscolhido(e.plano === "ativo" ? "cortesia" : "ativo"); }}>
                        Alterar plano
                      </Button>
                      {e.plano === "ativo" && (
                        <Button
                          type="button"
                          tamanho="sm"
                          variante="outline"
                          disabled={ocupado}
                          onClick={() => {
                            setPainel({ tipo: "comercial", empresaId: e.id });
                            setComercialEscolhido(e.planoComercial ?? "");
                            obterPlanosAdmin().then((r) => r.ok && setComerciais(r.dados)).catch((err) => setErro(mensagemDeErro(err)));
                          }}
                        >
                          Plano comercial
                        </Button>
                      )}
                      {e.bloqueadaEm ? (
                        <Button type="button" tamanho="sm" variante="outline" disabled={ocupado} onClick={() => setPainel({ tipo: "desbloquear", empresaId: e.id })}>
                          Desbloquear
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          tamanho="sm"
                          variante="danger"
                          disabled={ocupado || e.propria || e.temAdmin}
                          title={e.propria ? "Você não pode bloquear a sua própria empresa." : e.temAdmin ? "Tem um administrador da plataforma." : undefined}
                          onClick={() => setPainel({ tipo: "bloquear", empresaId: e.id })}
                        >
                          Bloquear
                        </Button>
                      )}
                    </span>
                  </div>

                  {aberto === "plano" && (
                    <div className="flex flex-col gap-3 border-t border-border pt-3">
                      <Select label="Novo plano" value={planoEscolhido} onChange={(ev) => setPlanoEscolhido(ev.target.value)}>
                        {PLANOS_ATRIBUIVEIS.map((p) => (
                          <option key={p} value={p} disabled={p === e.plano}>
                            {ROTULO_PLANO[p]}
                          </option>
                        ))}
                      </Select>
                      <PainelConfirmacao
                        rotuloMotivo={`Motivo da troca de plano de ${e.nome} (fica registrado)`}
                        rotuloBotao="Confirmar troca de plano"
                        ocupado={ocupado}
                        aoConfirmar={(motivo, senha) => executar(() => repo.alterarPlano(e.id, planoEscolhido, motivo, senha))}
                        aoCancelar={() => setPainel(null)}
                      />
                    </div>
                  )}
                  {aberto === "comercial" && (
                    <div className="flex flex-col gap-3 border-t border-border pt-3">
                      <Select label="Plano comercial contratado" value={comercialEscolhido} onChange={(ev) => setComercialEscolhido(ev.target.value)}>
                        <option value="">Nenhum</option>
                        {comerciais.map((p) => {
                          const semVaga = p.vagasRestantes === 0 && p.chave !== e.planoComercial;
                          return (
                            <option key={p.chave} value={p.chave} disabled={semVaga}>
                              {p.nome}{p.vagasTotal !== null ? ` (${p.vagasOcupadas} de ${p.vagasTotal} vagas ocupadas)` : ""}
                            </option>
                          );
                        })}
                      </Select>
                      <p className="text-xs text-muted">Só conta a vaga do plano e a comparação nas métricas. Não muda o acesso nem cobra.</p>
                      <PainelConfirmacao
                        rotuloMotivo={`Motivo (fica registrado)`}
                        rotuloBotao="Salvar plano comercial"
                        ocupado={ocupado}
                        aoConfirmar={(motivo, senha) => executar(() => definirPlanoComercialDaEmpresa(e.id, comercialEscolhido || null, motivo, senha))}
                        aoCancelar={() => setPainel(null)}
                      />
                    </div>
                  )}
                  {aberto === "bloquear" && (
                    <PainelConfirmacao
                      rotuloMotivo={`Motivo do bloqueio de ${e.nome} (interno, o usuário não vê). Ninguém da empresa entra e o perfil sai do ar; avaliações e indicações já publicadas ficam, modere-as em Avaliações.`}
                      rotuloBotao="Confirmar bloqueio"
                      perigo
                      ocupado={ocupado}
                      aoConfirmar={(motivo, senha) => executar(() => repo.bloquear(e.id, motivo, senha))}
                      aoCancelar={() => setPainel(null)}
                    />
                  )}
                  {aberto === "desbloquear" && (
                    <PainelConfirmacao
                      rotuloBotao="Confirmar desbloqueio"
                      ocupado={ocupado}
                      aoConfirmar={(_motivo, senha) => executar(() => repo.desbloquear(e.id, senha))}
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
