"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AcessoTemporario, CargoItem } from "@/types";
import { rotuloDoModulo, type ModuloChave } from "@/lib/auth/modulos";
import { listarCargos } from "@/services/data/server/cargosActions";
import { criarFuncionarioComAcesso } from "@/services/data/server/funcionariosActions";
import { useFuncionarios } from "@/hooks/useFuncionarios";
import { useObras } from "@/hooks/useObras";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";
import { useAcesso } from "@/components/layout/AcessoContext";
import { SeletorModulos } from "@/components/layout/SeletorModulos";
import { useStatusPlano } from "@/components/layout/StatusPlanoContext";
import { SeletorCargo } from "@/components/funcionarios/SeletorCargo";
import { SelectProjeto } from "@/components/contas/SelectProjeto";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/layout/PageHeader";
import { hojeISO } from "@/lib/formatadores";

const SENHA_INICIAL = "mudar1234";
const VALIDADE_DIAS = 7;

export default function NovoFuncionarioPage() {
  const router = useRouter();
  const { obras, criarObra, atualizarObra } = useObras();
  const { criarFuncionario } = useFuncionarios();
  const { somenteLeitura } = useStatusPlano();
  const { pessoa } = useAcesso();
  const souDono = pessoa.papel === "dono";

  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [dataAdmissao, setDataAdmissao] = useState(hojeISO());
  const [obraId, setObraId] = useState("");
  const [salario, setSalario] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [comAcesso, setComAcesso] = useState(false);
  const [modulos, setModulos] = useState<ModuloChave[]>([]);
  const [disponiveis, setDisponiveis] = useState<ModuloChave[]>([]);
  const [senhaDoDono, setSenhaDoDono] = useState("");
  const [criado, setCriado] = useState<{ funcionarioId: string; acesso: AcessoTemporario } | null>(null);

  useEffect(() => {
    if (!souDono) return;
    listarCargos().then((r) => {
      if (r.ok) setDisponiveis(r.dados.modulosDisponiveis);
    });
  }, [souDono]);

  function aoEscolherCargo(nomeCargo: string, c: CargoItem | null) {
    setCargo(nomeCargo);
    // O cargo traz os módulos de partida; a pessoa pode ajustar logo abaixo.
    if (c) setModulos(c.modulos);
  }

  const valido = nome.trim() !== "" && cargo.trim() !== "";
  const acessoValido = !comAcesso || (email.trim() !== "" && modulos.length > 0 && senhaDoDono !== "");

  async function salvar() {
    if (!valido || !acessoValido) return;
    setSalvando(true);
    setErro(null);
    const dados = {
      nome: nome.trim(),
      cargo: cargo.trim(),
      telefone: telefone.trim() || undefined,
      email: email.trim() || undefined,
      cpf: cpf.trim() || undefined,
      dataAdmissao,
      obraId: obraId || undefined,
      salario: salario ? Number(salario.replace(",", ".")) : undefined,
    };
    try {
      if (comAcesso) {
        const r = await criarFuncionarioComAcesso(dados, { modulos, senhaDoDono });
        if (!r.ok) {
          setErro(r.mensagem);
          return;
        }
        setSenhaDoDono("");
        setCriado({ funcionarioId: r.dados.funcionario.id, acesso: r.dados.acesso });
        return;
      }
      const funcionario = await criarFuncionario(dados);
      router.push(`/funcionarios/${funcionario.id}`);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setSalvando(false);
      setSenhaDoDono("");
    }
  }

  if (criado) {
    const { acesso } = criado;
    return (
      <div className="mx-auto max-w-xl animar-entrada">
        <PageHeader titulo="Funcionário cadastrado" />
        <Card className="flex flex-col gap-3">
          <p className="font-medium text-success">Passe estes dados para {acesso.nome} entrar no sistema</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm text-foreground">
            <dt className="text-muted">E-mail</dt>
            <dd className="break-all font-medium">{acesso.email}</dd>
            <dt className="text-muted">Senha inicial</dt>
            <dd className="font-mono font-medium">{acesso.senhaTemporaria}</dd>
            <dt className="text-muted">Acesso a</dt>
            <dd>{acesso.modulos.map(rotuloDoModulo).join(", ")}</dd>
          </dl>
          <p className="text-sm text-muted">
            No primeiro acesso a pessoa é obrigada a escolher uma senha só dela. A senha inicial vale por {acesso.validadeDias} dias; depois disso é preciso
            redefinir o acesso em Configurações.
          </p>
          <Button onClick={() => router.push(`/funcionarios/${criado.funcionarioId}`)}>Ir para a ficha do funcionário</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl animar-entrada">
      <PageHeader titulo="Novo funcionário" />
      {somenteLeitura && (
        <Card className="mb-3 border-warning bg-warning-bg text-sm text-warning">
          Somente leitura: seu teste ou assinatura não está ativo. Os dados continuam disponíveis para consulta.
        </Card>
      )}
      <Card className="flex flex-col gap-3">
        <Input label="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} />
        <SeletorCargo value={cargo} onChange={aoEscolherCargo} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          <Input label="CPF" value={cpf} onChange={(e) => setCpf(e.target.value)} />
        </div>
        <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Data de admissão" type="date" value={dataAdmissao} onChange={(e) => setDataAdmissao(e.target.value)} />
          <Input label="Salário (R$, opcional)" inputMode="decimal" value={salario} onChange={(e) => setSalario(e.target.value)} />
        </div>
        <SelectProjeto
          label="Projeto alocado (opcional)"
          value={obraId}
          onChange={setObraId}
          opcoes={obras}
          criarObra={criarObra}
          atualizarObra={atualizarObra}
          vazioEscolhivel
          rotuloVazio="Nenhuma"
        />

        {souDono && (
          <div className="flex flex-col gap-3 border-t border-border pt-3">
            <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-foreground">
              <input type="checkbox" checked={comAcesso} onChange={(e) => setComAcesso(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]" />
              <span>
                <span className="block font-medium">Dar acesso ao sistema a este funcionário</span>
                <span className="block text-xs text-muted">Ele entra com o e-mail acima e só vê os módulos que você marcar.</span>
              </span>
            </label>
            {comAcesso && (
              <>
                <div role="note" className="rounded-lg border border-warning/40 bg-warning-bg px-3 py-2 text-sm text-warning">
                  A senha inicial é <strong className="font-mono">{SENHA_INICIAL}</strong>. No primeiro acesso a pessoa é <strong>obrigada a trocá-la</strong>, e ela vale
                  por {VALIDADE_DIAS} dias. Avise o funcionário para entrar logo.
                </div>
                {!email.trim() && <p className="text-xs text-danger">Informe o e-mail do funcionário: é o login dele.</p>}
                <SeletorModulos disponiveis={disponiveis} selecionados={modulos} aoMudar={setModulos} desabilitado={salvando} />
                <Input
                  label="Sua senha (para confirmar)"
                  type="password"
                  value={senhaDoDono}
                  onChange={(e) => setSenhaDoDono(e.target.value)}
                  autoComplete="current-password"
                  maxLength={200}
                />
              </>
            )}
          </div>
        )}

        {erro && (
          <p role="alert" className="rounded-lg border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
            {erro}
          </p>
        )}
        <div className="flex gap-3 pt-2">
          <Button variante="outline" className="flex-1" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={salvar} disabled={!valido || !acessoValido || salvando || somenteLeitura}>
            {salvando ? "Salvando…" : comAcesso ? "Salvar e criar acesso" : "Salvar funcionário"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
