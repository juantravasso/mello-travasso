"use client";

import { useCallback, useEffect, useState } from "react";
import type { AcessoTemporario, ListaUsuariosEmpresa, ResultadoAction, SituacaoUsuarioEmpresa, UsuarioEmpresaItem } from "@/types";
import { usuariosEmpresaRepositorio as repo } from "@/services/data";
import { formatarDataHora } from "@/lib/formatadores";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";
import { rotuloDoModulo, type ModuloChave } from "@/lib/auth/modulos";
import { PainelConfirmacao } from "@/components/admin/PainelConfirmacao";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { SeletorModulos } from "./SeletorModulos";

const SITUACAO: Record<SituacaoUsuarioEmpresa, { rotulo: string; tom: "success" | "warning" | "danger" | "neutral" }> = {
  ativo: { rotulo: "Ativo", tom: "success" },
  aguardando_primeiro_acesso: { rotulo: "Aguardando primeiro acesso", tom: "warning" },
  senha_temporaria_vencida: { rotulo: "Senha temporária vencida", tom: "danger" },
  desativado: { rotulo: "Desativado", tom: "neutral" },
  bloqueado: { rotulo: "Bloqueado pela plataforma", tom: "danger" },
};

type Painel = { usuarioId: string; tipo: "redefinir" | "modulos" } | null;

/** Só o dono vê isto (a página nem renderiza para membros; as ações também recusam no servidor). */
export function UsuariosEmpresa() {
  const [lista, setLista] = useState<ListaUsuariosEmpresa | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [painel, setPainel] = useState<Painel>(null);
  const [acessoNovo, setAcessoNovo] = useState<{ titulo: string; acesso: AcessoTemporario } | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [modulosNovo, setModulosNovo] = useState<ModuloChave[]>([]);
  const [modalAberto, setModalAberto] = useState(false);

  const carregar = useCallback(async () => {
    const resultado = await repo.listar();
    if (!resultado.ok) throw new Error(resultado.mensagem);
    setLista(resultado.dados);
  }, []);

  useEffect(() => {
    carregar().catch((e) => setErro(mensagemDeErro(e)));
  }, [carregar]);

  async function executar<T>(acao: () => Promise<ResultadoAction<T>>, aoSucesso?: (dados: T) => void): Promise<boolean> {
    setOcupado(true);
    setErro(null);
    try {
      const resultado = await acao();
      if (!resultado.ok) {
        setErro(resultado.mensagem);
        return false;
      }
      aoSucesso?.(resultado.dados);
      await carregar();
      return true;
    } catch (e) {
      setErro(mensagemDeErro(e));
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function criar(evento: React.FormEvent) {
    evento.preventDefault();
    const ok = await executar(
      () => repo.criar({ nome, email, modulos: modulosNovo }, senha),
      (acesso) => setAcessoNovo({ titulo: "Usuário criado", acesso }),
    );
    if (ok) {
      setNome("");
      setEmail("");
      setModulosNovo([]);
      setModalAberto(false);
    }
    // A senha do dono nunca fica no formulário depois de usada, deu certo ou não.
    setSenha("");
  }

  const total = lista?.usuarios.length ?? 0;
  const noLimite = lista ? total >= lista.limite : false;

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <p className="font-medium text-foreground">Usuários da empresa</p>
        <p className="text-sm text-muted">
          Cada pessoa entra com o próprio e-mail, e o nome dela aparece em tudo o que lançar ou movimentar nas contas e no estoque.
        </p>
      </div>

      {erro && (
        <p role="alert" className="rounded-lg border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
          {erro}
        </p>
      )}

      {acessoNovo && (
        <div role="status" className="flex flex-col gap-2 rounded-lg border border-success bg-success-bg px-3 py-3 text-sm">
          <p className="font-medium text-success">{acessoNovo.titulo}: passe estes dados para {acessoNovo.acesso.nome}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-foreground">
            <dt className="text-muted">E-mail</dt>
            <dd className="break-all font-medium">{acessoNovo.acesso.email}</dd>
            <dt className="text-muted">Senha inicial</dt>
            <dd className="font-mono font-medium">{acessoNovo.acesso.senhaTemporaria}</dd>
            <dt className="text-muted">Acesso a</dt>
            <dd>{acessoNovo.acesso.modulos.map(rotuloDoModulo).join(", ")}</dd>
          </dl>
          <p className="text-muted">
            No primeiro acesso a pessoa é obrigada a escolher uma senha só dela. A senha inicial vale por {acessoNovo.acesso.validadeDias} dias; depois
            disso é preciso redefinir o acesso. Esta mensagem some quando você sair desta tela.
          </p>
          <Button type="button" tamanho="sm" variante="ghost" className="w-fit" onClick={() => setAcessoNovo(null)}>
            Entendi
          </Button>
        </div>
      )}

      {!lista ? (
        <div className="h-16 animate-pulse rounded-lg bg-surface-2" aria-busy="true" />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {lista.usuarios.map((u) => (
            <LinhaUsuario
              key={u.id}
              usuario={u}
              ocupado={ocupado}
              painel={painel?.usuarioId === u.id ? painel.tipo : null}
              modulosDisponiveis={lista.modulosDisponiveis}
              aoPedir={(tipo) => setPainel({ usuarioId: u.id, tipo })}
              aoCancelar={() => setPainel(null)}
              aoSalvarModulos={async (modulos, senhaDoDono) => {
                if (modulos.length === 0) {
                  setErro("Escolha ao menos um módulo para esta pessoa.");
                  return;
                }
                const ok = await executar(() => repo.alterarModulos(u.id, modulos, senhaDoDono));
                if (ok) setPainel(null);
              }}
              aoRedefinir={async (senhaDoDono) => {
                const ok = await executar(
                  () => repo.redefinirAcesso(u.id, senhaDoDono),
                  (acesso) => setAcessoNovo({ titulo: "Acesso redefinido", acesso }),
                );
                if (ok) setPainel(null);
              }}
              aoDesativar={() => executar(() => repo.desativar(u.id))}
              aoReativar={() => executar(() => repo.reativar(u.id))}
            />
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <Button
          type="button"
          className="w-fit"
          disabled={noLimite}
          onClick={() => {
            setErro(null);
            setModalAberto(true);
          }}
        >
          Adicionar usuário
        </Button>
        {noLimite && lista && <p className="text-sm text-muted">Limite de {lista.limite} usuários por empresa atingido.</p>}
      </div>

      {modalAberto && (
        <Modal
          titulo="Adicionar usuário"
          onFechar={() => {
            if (!ocupado) setModalAberto(false);
          }}
        >
          <form onSubmit={criar} className="flex flex-col gap-3" noValidate>
            <Input label="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} autoComplete="off" required />
            <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={180} autoComplete="off" required />
            {lista && <SeletorModulos disponiveis={lista.modulosDisponiveis} selecionados={modulosNovo} aoMudar={setModulosNovo} />}
            <Input
              label="Sua senha (para confirmar)"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              maxLength={200}
              autoComplete="current-password"
              required
            />
            {erro && (
              <p role="alert" className="rounded-lg border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
                {erro}
              </p>
            )}
            <Button type="submit" disabled={ocupado || noLimite || !nome.trim() || !email.trim() || !senha || modulosNovo.length === 0}>
              {ocupado ? "Criando…" : "Criar usuário"}
            </Button>
          </form>
        </Modal>
      )}
    </Card>
  );
}

function resumoModulos(modulos: ModuloChave[]): string {
  if (modulos.length === 0) return "nenhum módulo";
  const nomes = modulos.map(rotuloDoModulo);
  return nomes.length <= 3 ? nomes.join(", ") : `${nomes.slice(0, 3).join(", ")} e mais ${nomes.length - 3}`;
}

/** A atividade vem das sessões abertas: ao sair, a sessão some, então "sem sessão" não quer dizer que nunca entrou. */
function textoAtividade(u: UsuarioEmpresaItem): string {
  if (u.ultimoAcessoEm) return `Última atividade em ${formatarDataHora(u.ultimoAcessoEm)}`;
  if (u.situacao === "aguardando_primeiro_acesso" || u.situacao === "senha_temporaria_vencida") return "Ainda não entrou";
  return "Sem sessão aberta agora";
}

function LinhaUsuario({
  usuario: u,
  ocupado,
  painel,
  modulosDisponiveis,
  aoPedir,
  aoCancelar,
  aoSalvarModulos,
  aoRedefinir,
  aoDesativar,
  aoReativar,
}: {
  usuario: UsuarioEmpresaItem;
  ocupado: boolean;
  painel: "redefinir" | "modulos" | null;
  modulosDisponiveis: ModuloChave[];
  aoPedir: (tipo: "redefinir" | "modulos") => void;
  aoCancelar: () => void;
  aoSalvarModulos: (modulos: ModuloChave[], senhaDoDono: string) => void;
  aoRedefinir: (senhaDoDono: string) => void;
  aoDesativar: () => void;
  aoReativar: () => void;
}) {
  const situacao = SITUACAO[u.situacao];
  const membro = u.papel === "membro" && !u.voce;
  const [escolhidos, setEscolhidos] = useState<ModuloChave[]>(u.modulos);
  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-medium text-foreground">{u.nome}</span>
        {u.voce && <Badge tom="neutral">Você</Badge>}
        {u.papel === "dono" && !u.voce && <Badge tom="neutral">Responsável</Badge>}
        <Badge tom={situacao.tom}>{situacao.rotulo}</Badge>
      </div>
      <p className="break-all text-sm text-muted">{u.email}</p>
      <p className="text-xs text-muted">{textoAtividade(u)}</p>
      <p className="text-xs text-muted">{u.papel === "dono" ? "Acesso a todos os módulos" : `Acesso: ${resumoModulos(u.modulos)}`}</p>
      {membro && (
        <div className="flex flex-wrap gap-2">
          {u.situacao === "desativado" ? (
            <Button type="button" tamanho="sm" variante="outline" disabled={ocupado} onClick={aoReativar}>
              Reativar
            </Button>
          ) : (
            <>
              <Button
                type="button"
                tamanho="sm"
                variante="outline"
                disabled={ocupado}
                onClick={() => {
                  setEscolhidos(u.modulos);
                  aoPedir("modulos");
                }}
              >
                Editar módulos
              </Button>
              <Button type="button" tamanho="sm" variante="outline" disabled={ocupado} onClick={() => aoPedir("redefinir")}>
                Redefinir acesso
              </Button>
              <Button type="button" tamanho="sm" variante="ghost" disabled={ocupado} onClick={aoDesativar}>
                Desativar
              </Button>
            </>
          )}
        </div>
      )}
      {painel === "redefinir" && (
        <PainelConfirmacao
          rotuloBotao="Redefinir acesso"
          ocupado={ocupado}
          aoConfirmar={(_motivo, senhaDoDono) => aoRedefinir(senhaDoDono)}
          aoCancelar={aoCancelar}
        />
      )}
      {painel === "modulos" && (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <SeletorModulos disponiveis={modulosDisponiveis} selecionados={escolhidos} aoMudar={setEscolhidos} desabilitado={ocupado} />
          <PainelConfirmacao
            rotuloBotao="Salvar módulos"
            ocupado={ocupado}
            aoConfirmar={(_motivo, senhaDoDono) => aoSalvarModulos(escolhidos, senhaDoDono)}
            aoCancelar={aoCancelar}
          />
        </div>
      )}
    </li>
  );
}
