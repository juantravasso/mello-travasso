"use client";

import { useActionState, useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { criarConta } from "@/services/data/server/authActions";
import { buscarEmpresaPorCnpj } from "@/lib/lookupPublico";
import { cnpjValido, cpfValido } from "@/lib/validacao/documento";
import { formatarCpfCnpj } from "@/lib/documento";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type TipoPessoa = "pj" | "pf";
type ModoCadastro = "teste" | "rede";

const OPCOES_MODO: { valor: ModoCadastro; titulo: string; descricao: string }[] = [
  { valor: "teste", titulo: "Teste de 30 dias", descricao: "Elo Gestão e Elo Profissionais: projetos, contas, estoque, perfil público e avaliações." },
  { valor: "rede", titulo: "Só o Elo Profissionais", descricao: "Perfil público, busca e avaliações. Grátis, sem prazo." },
];

interface EstadoCadastro {
  erroGeral?: string;
  campos?: Record<string, string>;
}

const ESTADO_INICIAL: EstadoCadastro = {};

export function CriarContaForm({ codigoConvite }: { codigoConvite?: string }) {
  const router = useRouter();
  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoa>("pj");
  const [modo, setModo] = useState<ModoCadastro>("teste");
  const [documento, setDocumento] = useState("");
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [avisoCnpj, setAvisoCnpj] = useState<string | null>(null);
  const [situacaoCadastral, setSituacaoCadastral] = useState<string | null>(null);
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const buscaEmAndamentoPara = useRef<string | null>(null);

  async function aoMudarDocumento(valor: string) {
    setDocumento(valor);
    setAvisoCnpj(null);
    const digitos = valor.replace(/\D/g, "");
    if (tipoPessoa !== "pj" || digitos.length !== 14) {
      setSituacaoCadastral(null);
      return;
    }
    if (!cnpjValido(digitos)) return;

    buscaEmAndamentoPara.current = digitos;
    setBuscandoCnpj(true);
    try {
      const empresa = await buscarEmpresaPorCnpj(digitos);
      // Se o usuário já apagou/trocou o CNPJ enquanto a consulta rodava, o
      // resultado chegou atrasado — descarta em vez de preencher errado.
      if (buscaEmAndamentoPara.current !== digitos) return;

      if (!empresa) {
        setAvisoCnpj("Não achamos esse CNPJ na Receita agora. Preencha os dados manualmente.");
        return;
      }
      setRazaoSocial((atual) => atual || empresa.razaoSocial || empresa.nome);
      setNomeFantasia((atual) => atual || empresa.nomeFantasia || "");
      setTelefone((atual) => atual || empresa.telefone || "");
      setCep((atual) => atual || empresa.cep || "");
      setLogradouro((atual) => atual || empresa.logradouro || "");
      setNumero((atual) => atual || empresa.numero || "");
      setComplemento((atual) => atual || empresa.complemento || "");
      setBairro((atual) => atual || empresa.bairro || "");
      setCidade((atual) => atual || empresa.cidade || "");
      setEstado((atual) => atual || empresa.estado || "");
      setSituacaoCadastral(empresa.situacaoCadastral ?? null);
    } finally {
      if (buscaEmAndamentoPara.current === digitos) setBuscandoCnpj(false);
    }
  }

  function trocarTipoPessoa(novoTipo: TipoPessoa) {
    setTipoPessoa(novoTipo);
    setDocumento("");
    setSituacaoCadastral(null);
    setAvisoCnpj(null);
  }

  const acao = useCallback(
    async (_estadoAnterior: EstadoCadastro, formData: FormData): Promise<EstadoCadastro> => {
      const documentoDigitado = String(formData.get("documento") ?? "");
      const digitos = documentoDigitado.replace(/\D/g, "");
      const valido = tipoPessoa === "pj" ? cnpjValido(digitos) : cpfValido(digitos);
      if (!valido) {
        return {
          campos: {
            documento:
              tipoPessoa === "pj" ? "CNPJ inválido — confira os 14 dígitos" : "CPF inválido — confira os 11 dígitos",
          },
        };
      }

      const resultado = await criarConta({
        tipoPessoa,
        documento: digitos,
        razaoSocial: String(formData.get("razaoSocial") ?? ""),
        nomeFantasia: String(formData.get("nomeFantasia") ?? "") || undefined,
        situacaoCadastral: situacaoCadastral ?? undefined,
        telefone: String(formData.get("telefone") ?? "") || undefined,
        cep: String(formData.get("cep") ?? "") || undefined,
        logradouro: String(formData.get("logradouro") ?? "") || undefined,
        numero: String(formData.get("numero") ?? "") || undefined,
        complemento: String(formData.get("complemento") ?? "") || undefined,
        bairro: String(formData.get("bairro") ?? "") || undefined,
        cidade: String(formData.get("cidade") ?? "") || undefined,
        estado: String(formData.get("estado") ?? "") || undefined,
        nomeUsuario: String(formData.get("nomeUsuario") ?? ""),
        email: String(formData.get("email") ?? ""),
        senha: String(formData.get("senha") ?? ""),
        modo,
        codigoConvite,
        aceiteTermos: formData.get("aceiteTermos") === "on",
        empresaConfirmacao: String(formData.get("empresaConfirmacao") ?? ""),
      });

      if (resultado.ok) {
        router.push(resultado.dados.redirecionarPara);
        router.refresh();
        return ESTADO_INICIAL;
      }
      return { erroGeral: resultado.mensagem, campos: resultado.campos };
    },
    [tipoPessoa, situacaoCadastral, modo, codigoConvite, router],
  );

  const [estadoForm, formAction, emAndamento] = useActionState(acao, ESTADO_INICIAL);

  return (
    <form action={formAction} className="grid gap-8 lg:grid-cols-[5fr_6fr]" noValidate>
      {/* Honeypot (RF-21): escondido via CSS fora da tela, nunca com type="hidden" — alguns bots pulam esse tipo. Um humano nunca vê nem preenche. */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-0 w-0 overflow-hidden">
        <label htmlFor="empresaConfirmacao">Deixe este campo em branco</label>
        <input type="text" id="empresaConfirmacao" name="empresaConfirmacao" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex gap-2 rounded-lg border border-border bg-surface p-1">
          <button
            type="button"
            onClick={() => trocarTipoPessoa("pj")}
            className={`h-9 flex-1 rounded-md text-sm font-medium transition-colors ${tipoPessoa === "pj" ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground"}`}
          >
            Empresa (CNPJ)
          </button>
          <button
            type="button"
            onClick={() => trocarTipoPessoa("pf")}
            className={`h-9 flex-1 rounded-md text-sm font-medium transition-colors ${tipoPessoa === "pf" ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground"}`}
          >
            Autônomo (CPF)
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <Input
            id="documento"
            name="documento"
            label={tipoPessoa === "pj" ? "CNPJ" : "CPF"}
            placeholder={tipoPessoa === "pj" ? "00.000.000/0000-00" : "000.000.000-00"}
            value={documento}
            onChange={(e) => aoMudarDocumento(formatarCpfCnpj(e.target.value) || e.target.value)}
            erro={estadoForm.campos?.documento}
            className="font-mono tabular-nums"
            required
          />
          {tipoPessoa === "pj" && (
            <p className="text-xs text-muted" aria-live="polite">
              {buscandoCnpj
                ? "Consultando a Receita…"
                : "Digite o CNPJ — buscamos razão social e endereço na Receita."}
            </p>
          )}
          {avisoCnpj && <p className="text-xs text-info">{avisoCnpj}</p>}
        </div>

        <Input
          id="razaoSocial"
          name="razaoSocial"
          label={tipoPessoa === "pj" ? "Razão social" : "Nome completo"}
          value={razaoSocial}
          onChange={(e) => setRazaoSocial(e.target.value)}
          erro={estadoForm.campos?.razaoSocial}
          required
        />

        {tipoPessoa === "pj" && (
          <Input
            id="nomeFantasia"
            name="nomeFantasia"
            label="Nome fantasia (opcional)"
            value={nomeFantasia}
            onChange={(e) => setNomeFantasia(e.target.value)}
          />
        )}

        <Input id="telefone" name="telefone" label="Telefone (opcional)" value={telefone} onChange={(e) => setTelefone(e.target.value)} />

        <div className="grid grid-cols-2 gap-3">
          <Input id="cep" name="cep" label="CEP (opcional)" value={cep} onChange={(e) => setCep(e.target.value)} />
          <Input id="estado" name="estado" label="UF (opcional)" maxLength={2} value={estado} onChange={(e) => setEstado(e.target.value.toUpperCase())} />
        </div>
        <Input id="logradouro" name="logradouro" label="Endereço (opcional)" value={logradouro} onChange={(e) => setLogradouro(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input id="numero" name="numero" label="Número (opcional)" value={numero} onChange={(e) => setNumero(e.target.value)} />
          <Input id="complemento" name="complemento" label="Complemento (opcional)" value={complemento} onChange={(e) => setComplemento(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input id="bairro" name="bairro" label="Bairro (opcional)" value={bairro} onChange={(e) => setBairro(e.target.value)} />
          <Input id="cidade" name="cidade" label="Cidade (opcional)" value={cidade} onChange={(e) => setCidade(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-3 border-dashed">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Ficha cadastral</p>
            {situacaoCadastral && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${situacaoCadastral.toUpperCase() === "ATIVA" ? "bg-success-bg text-success" : "bg-warning-bg text-warning"}`}
              >
                {situacaoCadastral}
              </span>
            )}
          </div>
          {situacaoCadastral !== null && (
            <p className="text-xs text-muted">Dados da Receita — confirme ou corrija.</p>
          )}
          <dl className="flex flex-col gap-2 font-mono text-sm tabular-nums">
            <FichaLinha rotulo={tipoPessoa === "pj" ? "CNPJ" : "CPF"} valor={documento || "—"} carregando={buscandoCnpj} />
            <FichaLinha rotulo="Nome" valor={razaoSocial || "—"} carregando={buscandoCnpj} />
            {tipoPessoa === "pj" && <FichaLinha rotulo="Fantasia" valor={nomeFantasia || "—"} carregando={buscandoCnpj} />}
            <FichaLinha rotulo="Cidade/UF" valor={cidade ? `${cidade}${estado ? "/" + estado : ""}` : "—"} carregando={buscandoCnpj} />
          </dl>
        </Card>

        <hr className="border-border" />

        <Input id="nomeUsuario" name="nomeUsuario" label="Seu nome" autoComplete="name" required erro={estadoForm.campos?.nomeUsuario} />
        <Input id="email" name="email" type="email" label="E-mail" autoComplete="email" required erro={estadoForm.campos?.email} />
        <Input
          id="senha"
          name="senha"
          type="password"
          label="Senha"
          autoComplete="new-password"
          minLength={10}
          required
          erro={estadoForm.campos?.senha}
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-foreground">Como quer começar?</legend>
          {OPCOES_MODO.map((opcao) => (
            <label
              key={opcao.valor}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors ${modo === opcao.valor ? "border-primary bg-primary/10" : "border-border bg-surface hover:bg-surface-2"}`}
            >
              <input
                type="radio"
                name="modo"
                value={opcao.valor}
                checked={modo === opcao.valor}
                onChange={() => setModo(opcao.valor)}
                className="mt-0.5 h-4 w-4"
              />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium text-foreground">{opcao.titulo}</span>
                <span className="text-xs text-muted">{opcao.descricao}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <label className="flex items-start gap-2 text-sm text-muted">
          <input type="checkbox" name="aceiteTermos" required className="mt-0.5 h-4 w-4 rounded border-border" />
          <span>
            Li e aceito os{" "}
            <Link href="/termos" target="_blank" className="text-primary underline underline-offset-2">
              Termos de Uso
            </Link>{" "}
            e a{" "}
            <Link href="/privacidade" target="_blank" className="text-primary underline underline-offset-2">
              Política de Privacidade
            </Link>
            .
          </span>
        </label>

        {estadoForm.erroGeral && (
          <p role="alert" aria-live="polite" className="rounded-lg border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
            {estadoForm.erroGeral}
          </p>
        )}

        <Button type="submit" variante="primary" className="w-full shadow-none" aria-busy={emAndamento} disabled={emAndamento}>
          {emAndamento ? "Criando conta…" : modo === "rede" ? "Criar conta grátis" : "Criar conta e começar o teste"}
        </Button>
        <p className="text-center text-xs text-muted">
          {modo === "rede" ? "Grátis, sem prazo. Dá para testar o Elo Gestão depois." : "30 dias grátis. Sem cartão de crédito."}
        </p>
      </div>
    </form>
  );
}

function FichaLinha({ rotulo, valor, carregando }: { rotulo: string; valor: string; carregando: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="font-sans text-xs uppercase tracking-wide text-muted">{rotulo}</dt>
      <dd className={carregando ? "h-4 w-24 animate-pulse rounded bg-surface-2 text-transparent" : "text-foreground"}>
        {valor}
      </dd>
    </div>
  );
}
