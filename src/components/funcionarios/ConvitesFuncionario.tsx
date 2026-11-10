"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ConviteFuncionarioCriado, ConviteFuncionarioItem } from "@/types";
import { useObras } from "@/hooks/useObras";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { formatarData, hojeISO } from "@/lib/formatadores";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";
import {
  aprovarConviteFuncionario,
  cancelarConviteFuncionario,
  criarConviteFuncionario,
  listarConvitesFuncionario,
  recusarConviteFuncionario,
} from "@/services/data/server/conviteFuncionarioActions";

/** Cadastro por link: o dono gera um link individual, a pessoa preenche e aqui ele revisa e aprova. */
export function ConvitesFuncionario({ aoAprovar, somenteLeitura }: { aoAprovar: () => void; somenteLeitura?: boolean }) {
  const [convites, setConvites] = useState<ConviteFuncionarioItem[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [revisando, setRevisando] = useState<ConviteFuncionarioItem | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await listarConvitesFuncionario();
      if (r.ok) setConvites(r.dados);
      else setErro(r.mensagem);
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function cancelar(id: string) {
    setErro(null);
    const r = await cancelarConviteFuncionario(id).catch((e) => ({ ok: false as const, mensagem: mensagemDeErro(e) }));
    if (!r.ok) setErro(r.mensagem);
    await carregar();
  }

  const aguardando = (convites ?? []).filter((c) => c.situacao === "aguardando_aprovacao");
  const emAberto = (convites ?? []).filter((c) => c.situacao !== "aguardando_aprovacao");

  return (
    <section className="mb-5 flex flex-col gap-3" aria-labelledby="titulo-convites-func">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="titulo-convites-func" className="font-medium text-foreground">
            Cadastro pelo link
          </h2>
          <p className="text-sm text-muted">Mande um link para o funcionário preencher os próprios dados. Você só confere e aprova.</p>
        </div>
        {!somenteLeitura && <Button onClick={() => setGerando(true)}>Enviar link de cadastro</Button>}
      </Card>

      {erro && (
        <p role="alert" className="text-sm text-danger">
          {erro}
        </p>
      )}

      {aguardando.length > 0 && (
        <Card className="flex flex-col gap-2 border-primary/50">
          <h3 className="text-sm font-semibold text-foreground">Aguardando a sua aprovação ({aguardando.length})</h3>
          <ul className="flex flex-col gap-2">
            {aguardando.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-2 p-3">
                <div className="min-w-0">
                  <p className="break-words font-medium text-foreground">{c.dados?.nome ?? "Sem nome"}</p>
                  <p className="break-words text-sm text-muted">
                    {c.dados?.cargo} {c.preenchidoEm ? `· enviado em ${formatarData(c.preenchidoEm.slice(0, 10))}` : ""}
                  </p>
                </div>
                {!somenteLeitura && (
                  <Button tamanho="sm" onClick={() => setRevisando(c)}>
                    Revisar e aprovar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {emAberto.length > 0 && (
        <Card className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground">Links enviados ({emAberto.length})</h3>
          <ul className="flex flex-col gap-2">
            {emAberto.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="break-words font-medium text-foreground">{c.nomeSugerido ?? "Sem nome informado"}</span>
                  {c.cargoSugerido && <span className="text-muted">{c.cargoSugerido}</span>}
                  <Badge tom={c.situacao === "expirado" ? "neutral" : "warning"}>
                    {c.situacao === "expirado" ? "Venceu" : `Aguardando preenchimento · vale até ${formatarData(c.expiraEm.slice(0, 10))}`}
                  </Badge>
                </div>
                {!somenteLeitura && (
                  <Button tamanho="sm" variante="ghost" onClick={() => void cancelar(c.id)}>
                    {c.situacao === "expirado" ? "Remover" : "Cancelar link"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {gerando && <ModalGerarLink aoFechar={() => { setGerando(false); void carregar(); }} />}
      {revisando && (
        <ModalRevisar
          convite={revisando}
          aoFechar={() => setRevisando(null)}
          aoConcluir={() => {
            setRevisando(null);
            void carregar();
            aoAprovar();
          }}
        />
      )}
    </section>
  );
}

function ModalGerarLink({ aoFechar }: { aoFechar: () => void }) {
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [criado, setCriado] = useState<ConviteFuncionarioCriado | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  async function gerar() {
    setOcupado(true);
    setErro(null);
    try {
      const r = await criarConviteFuncionario({ nomeSugerido: nome, cargoSugerido: cargo });
      if (r.ok) setCriado(r.dados);
      else setErro(r.mensagem);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  async function copiar() {
    if (!criado) return;
    try {
      await navigator.clipboard.writeText(criado.link);
    } catch {
      campo.current?.select();
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  const mensagem = criado ? `Olá${nome.trim() ? `, ${nome.trim().split(" ")[0]}` : ""}! Preencha o seu cadastro de funcionário por este link (vale 7 dias, uso único): ${criado.link}` : "";

  return (
    <Modal titulo="Link de cadastro do funcionário" onFechar={aoFechar}>
      {!criado ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">Cada link é de uma pessoa só: depois que ela preencher, ele deixa de funcionar. Os dois campos abaixo são opcionais e já vêm preenchidos para ela.</p>
          <Input label="Nome (opcional)" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={160} />
          <Input label="Cargo (opcional)" value={cargo} onChange={(e) => setCargo(e.target.value)} maxLength={160} />
          {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
          <div className="flex gap-2">
            <Button variante="outline" className="flex-1" onClick={aoFechar} disabled={ocupado}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={() => void gerar()} disabled={ocupado}>
              {ocupado ? "Gerando…" : "Gerar link"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            Link pronto. Copie agora: por segurança ele não fica guardado e não dá para ver de novo (se perder, gere outro). Vale até {formatarData(criado.expiraEm.slice(0, 10))}.
          </p>
          <input
            ref={campo}
            readOnly
            value={criado.link}
            aria-label="Link de cadastro do funcionário"
            onFocus={(e) => e.currentTarget.select()}
            className="h-11 w-full min-w-0 rounded-lg border border-border bg-surface px-3 font-mono text-sm text-foreground outline-none focus:border-primary"
          />
          <div className="flex flex-wrap gap-2">
            <Button tamanho="sm" onClick={() => void copiar()}>
              {copiado ? "Link copiado" : "Copiar link"}
            </Button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
            >
              Enviar pelo WhatsApp
            </a>
          </div>
          <Button variante="outline" onClick={aoFechar}>
            Concluir
          </Button>
        </div>
      )}
    </Modal>
  );
}

function ModalRevisar({ convite, aoFechar, aoConcluir }: { convite: ConviteFuncionarioItem; aoFechar: () => void; aoConcluir: () => void }) {
  const { obras } = useObras();
  const d = convite.dados;
  const [nome, setNome] = useState(d?.nome ?? "");
  const [cargo, setCargo] = useState(d?.cargo ?? "");
  const [telefone, setTelefone] = useState(d?.telefone ?? "");
  const [email, setEmail] = useState(d?.email ?? "");
  const [cpf, setCpf] = useState(d?.cpf ?? "");
  const [dataAdmissao, setDataAdmissao] = useState(hojeISO());
  const [obraId, setObraId] = useState("");
  const [salario, setSalario] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function aprovar() {
    setOcupado(true);
    setErro(null);
    const valor = Number(salario.replace(",", "."));
    try {
      const r = await aprovarConviteFuncionario(convite.id, {
        nome,
        cargo,
        telefone: telefone || undefined,
        email: email || undefined,
        cpf: cpf || undefined,
        dataAdmissao,
        obraId: obraId || undefined,
        salario: salario.trim() && Number.isFinite(valor) && valor >= 0 ? valor : undefined,
      });
      if (r.ok) aoConcluir();
      else setErro(r.mensagem);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  async function recusar() {
    setOcupado(true);
    setErro(null);
    try {
      const r = await recusarConviteFuncionario(convite.id);
      if (r.ok) aoConcluir();
      else setErro(r.mensagem);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Modal titulo="Revisar cadastro" tamanho="lg" onFechar={aoFechar}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">Confira o que a pessoa enviou (você pode corrigir) e complete o que falta. Ao aprovar, ela vira funcionário ativo.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={160} />
          <Input label="Cargo" value={cargo} onChange={(e) => setCargo(e.target.value)} maxLength={160} />
          <Input label="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} maxLength={30} />
          <Input label="CPF" value={cpf} onChange={(e) => setCpf(e.target.value)} maxLength={20} />
          <div className="sm:col-span-2">
            <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={180} />
          </div>
          <Input label="Data de admissão" type="date" value={dataAdmissao} onChange={(e) => setDataAdmissao(e.target.value)} />
          <Input label="Salário (R$, opcional)" inputMode="decimal" value={salario} onChange={(e) => setSalario(e.target.value)} />
          <div className="sm:col-span-2">
            <Select label="Projeto (opcional)" value={obraId} onChange={(e) => setObraId(e.target.value)}>
              <option value="">Sem projeto</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
        <div className="flex flex-wrap gap-2">
          <Button variante="danger" onClick={() => void recusar()} disabled={ocupado}>
            Recusar
          </Button>
          <Button variante="outline" className="flex-1" onClick={aoFechar} disabled={ocupado}>
            Fechar
          </Button>
          <Button className="flex-1" onClick={() => void aprovar()} disabled={ocupado || nome.trim().length < 1 || cargo.trim().length < 1 || !dataAdmissao}>
            {ocupado ? "Salvando…" : "Aprovar funcionário"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
