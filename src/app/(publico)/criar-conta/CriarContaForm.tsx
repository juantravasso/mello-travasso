"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { criarConta } from "@/services/data/server/authActions";
import { buscarEmpresaPorCnpj } from "@/lib/lookupPublico";
import { cnpjValido } from "@/lib/validacao/documento";
import { TAMANHO_MINIMO_SENHA } from "@/lib/validacao/auth";
import { listarErrosDoCadastro, validarCadastroNoNavegador, type TipoPessoaCadastro } from "@/lib/validacao/cadastroMensagens";
import { formatarCep } from "@/lib/cep";
import { formatarCpfCnpj } from "@/lib/documento";
import { useBuscaCep } from "@/hooks/useBuscaCep";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type ModoCadastro = "teste" | "rede";

const opcoesDeModo = (dias: number): { valor: ModoCadastro; titulo: string; descricao: string }[] => [
  { valor: "teste", titulo: `Teste de ${dias} dias`, descricao: "Elo Gestão e Elo Profissionais: projetos, contas, estoque, perfil público e avaliações." },
  { valor: "rede", titulo: "Só o Elo Profissionais", descricao: "Perfil público, busca e avaliações. Grátis, sem prazo." },
];

interface EstadoCadastro {
  erroGeral?: string;
  campos?: Record<string, string>;
}

const ESTADO_INICIAL: EstadoCadastro = {};

/**
 * Cadastro enxuto. Autônomo: nome, CPF, e-mail e senha. Empresa: CNPJ (a Receita preenche o resto), nome do responsável,
 * e-mail e senha; o endereço é opcional e fica recolhido. Telefone e endereço completos se preenchem depois, em
 * Configurações. Os erros aparecem todos juntos, cada um com o nome do campo e o que fazer.
 */
export function CriarContaForm({ codigoConvite, diasDeTeste }: { codigoConvite?: string; diasDeTeste: number }) {
  const router = useRouter();
  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoaCadastro>("pj");
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
  const [senha, setSenha] = useState("");
  // Campos controlados: depois de um envio com erro o React limpa os campos que não são, e a pessoa teria que digitar de novo.
  const [nomeUsuario, setNomeUsuario] = useState("");
  const [email, setEmail] = useState("");
  const [aceiteTermos, setAceiteTermos] = useState(false);
  const buscaEmAndamentoPara = useRef<string | null>(null);

  // CEP completo → preenche rua, bairro, cidade e UF (o número e o complemento a pessoa informa).
  const cepBusca = useBuscaCep((e) => {
    setLogradouro((atual) => e.logradouro || atual);
    setBairro((atual) => e.bairro || atual);
    setCidade((atual) => e.cidade || atual);
    setEstado((atual) => e.estado || atual);
  });

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
        setAvisoCnpj("Não achamos esse CNPJ na Receita agora. Preencha o nome da empresa manualmente.");
        return;
      }
      setRazaoSocial((atual) => atual || empresa.razaoSocial || empresa.nome);
      setNomeFantasia((atual) => atual || empresa.nomeFantasia || "");
      setTelefone((atual) => atual || empresa.telefone || "");
      setCep((atual) => atual || formatarCep(empresa.cep ?? ""));
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

  function trocarTipoPessoa(novoTipo: TipoPessoaCadastro) {
    if (novoTipo === tipoPessoa) return;
    setTipoPessoa(novoTipo);
    // Os dados que vieram da Receita (ou do tipo anterior) não valem para o outro tipo de conta.
    setDocumento("");
    setRazaoSocial("");
    setNomeFantasia("");
    setTelefone("");
    setCep("");
    setLogradouro("");
    setNumero("");
    setComplemento("");
    setBairro("");
    setCidade("");
    setEstado("");
    setSituacaoCadastral(null);
    setAvisoCnpj(null);
    buscaEmAndamentoPara.current = null;
    setBuscandoCnpj(false);
  }

  const acao = useCallback(
    async (_estadoAnterior: EstadoCadastro, formData: FormData): Promise<EstadoCadastro> => {
      const digitos = String(formData.get("documento") ?? "").replace(/\D/g, "");
      const pj = tipoPessoa === "pj";
      const dados = {
        tipoPessoa,
        documento: digitos,
        razaoSocial,
        // Autônomo: o nome da conta e o da pessoa são o mesmo, então só se pergunta uma vez.
        nomeUsuario: pj ? nomeUsuario : razaoSocial,
        nomeFantasia: (pj && nomeFantasia) || undefined,
        situacaoCadastral: (pj && situacaoCadastral) || undefined,
        telefone: (pj && telefone) || undefined,
        cep: (pj && cep) || undefined,
        logradouro: (pj && logradouro) || undefined,
        numero: (pj && numero) || undefined,
        complemento: (pj && complemento) || undefined,
        bairro: (pj && bairro) || undefined,
        cidade: (pj && cidade) || undefined,
        estado: (pj && estado) || undefined,
        email,
        senha,
        modo,
        codigoConvite,
        aceiteTermos,
        empresaConfirmacao: String(formData.get("empresaConfirmacao") ?? ""),
      };

      // Confere no navegador, com o mesmo esquema do servidor: mostra tudo o que falta de uma vez, sem esperar a viagem.
      const camposNavegador = validarCadastroNoNavegador(dados);
      // Autônomo não tem o campo "Seu nome": o nome dele é o "Nome completo", que já aparece com o seu próprio erro.
      if (!pj) delete camposNavegador.nomeUsuario;
      if (Object.keys(camposNavegador).length > 0) {
        const n = Object.keys(camposNavegador).length;
        return { erroGeral: n === 1 ? "Há 1 campo para corrigir antes de criar a conta." : `Há ${n} campos para corrigir antes de criar a conta.`, campos: camposNavegador };
      }

      const resultado = await criarConta(dados);
      if (resultado.ok) {
        router.push(resultado.dados.redirecionarPara);
        router.refresh();
        return ESTADO_INICIAL;
      }
      return { erroGeral: resultado.mensagem, campos: resultado.campos };
    },
    [tipoPessoa, nomeUsuario, email, aceiteTermos, razaoSocial, nomeFantasia, situacaoCadastral, telefone, cep, logradouro, numero, complemento, bairro, cidade, estado, senha, modo, codigoConvite, router],
  );

  const [estadoForm, formAction, emAndamento] = useActionState(acao, ESTADO_INICIAL);
  const erros = listarErrosDoCadastro(estadoForm.campos ?? {}, tipoPessoa);
  const campos = estadoForm.campos ?? {};
  const pj = tipoPessoa === "pj";
  const faltamNaSenha = Math.max(0, TAMANHO_MINIMO_SENHA - senha.length);

  // Depois de um envio com erro, leva o foco ao primeiro campo com problema.
  useEffect(() => {
    const primeiro = listarErrosDoCadastro(estadoForm.campos ?? {}, tipoPessoa)[0];
    if (primeiro) document.getElementById(primeiro.campo)?.focus();
  }, [estadoForm, tipoPessoa]);

  const enderecoPreenchido = [logradouro, bairro, cidade].some(Boolean);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4" noValidate>
      {/* Honeypot (RF-21): escondido via CSS fora da tela, nunca com type="hidden" — alguns bots pulam esse tipo. Um humano nunca vê nem preenche. */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-0 w-0 overflow-hidden">
        <label htmlFor="empresaConfirmacao">Deixe este campo em branco</label>
        <input type="text" id="empresaConfirmacao" name="empresaConfirmacao" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex gap-2 rounded-lg border border-border bg-surface p-1" role="group" aria-label="Tipo de conta">
        <button
          type="button"
          aria-pressed={pj}
          onClick={() => trocarTipoPessoa("pj")}
          className={`h-9 flex-1 rounded-md text-sm font-medium transition-colors ${pj ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground"}`}
        >
          Empresa (CNPJ)
        </button>
        <button
          type="button"
          aria-pressed={!pj}
          onClick={() => trocarTipoPessoa("pf")}
          className={`h-9 flex-1 rounded-md text-sm font-medium transition-colors ${!pj ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground"}`}
        >
          Autônomo (CPF)
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <Input
          id="documento"
          name="documento"
          label={pj ? "CNPJ" : "CPF"}
          placeholder={pj ? "00.000.000/0000-00" : "000.000.000-00"}
          value={documento}
          onChange={(e) => aoMudarDocumento(formatarCpfCnpj(e.target.value) || e.target.value)}
          erro={campos.documento}
          inputMode="numeric"
          autoComplete="off"
          className="font-mono tabular-nums"
          required
        />
        {pj && (
          <p className="text-xs text-muted" aria-live="polite">
            {buscandoCnpj ? "Consultando a Receita…" : "Digite o CNPJ: buscamos o nome e o endereço da empresa na Receita."}
          </p>
        )}
        {avisoCnpj && <p className="text-xs text-info">{avisoCnpj}</p>}
      </div>

      <Input
        id="razaoSocial"
        name="razaoSocial"
        label={pj ? "Razão social" : "Nome completo"}
        autoComplete={pj ? "organization" : "name"}
        value={razaoSocial}
        onChange={(e) => setRazaoSocial(e.target.value)}
        erro={campos.razaoSocial}
        required
      />

      {pj && situacaoCadastral && (
        <p className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted">
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${situacaoCadastral.toUpperCase() === "ATIVA" ? "bg-success-bg text-success" : "bg-warning-bg text-warning"}`}
          >
            {situacaoCadastral}
          </span>
          Dados da Receita. Confira o nome e corrija se precisar.
        </p>
      )}

      {pj && <Input id="nomeUsuario" name="nomeUsuario" label="Seu nome (responsável pela conta)" autoComplete="name" value={nomeUsuario} onChange={(e) => setNomeUsuario(e.target.value)} erro={campos.nomeUsuario} required />}

      <Input id="email" name="email" type="email" label="E-mail" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} erro={campos.email} required />

      <div className="flex flex-col gap-1">
        <Input
          id="senha"
          name="senha"
          type="password"
          label="Senha"
          autoComplete="new-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          erro={campos.senha}
          required
        />
        {!campos.senha && (
          <p className="text-xs text-muted" aria-live="polite">
            {senha.length === 0
              ? `Mínimo de ${TAMANHO_MINIMO_SENHA} caracteres.`
              : faltamNaSenha > 0
                ? `Faltam ${faltamNaSenha} ${faltamNaSenha === 1 ? "caractere" : "caracteres"} para o mínimo de ${TAMANHO_MINIMO_SENHA}.`
                : "Tamanho da senha ok."}
          </p>
        )}
      </div>

      {pj && (
        <details className="rounded-lg border border-border bg-surface px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            Endereço da empresa <span className="font-normal text-muted">(opcional{enderecoPreenchido ? ", já preenchido" : ""})</span>
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Input
                id="cep"
                name="cep"
                label="CEP"
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder="00000-000"
                value={cep}
                onChange={(e) => setCep(cepBusca.aoDigitar(e.target.value))}
                erro={campos.cep}
              />
              <Input id="estado" name="estado" label="UF" maxLength={2} value={estado} onChange={(e) => setEstado(e.target.value.toUpperCase())} erro={campos.estado} />
            </div>
            {cepBusca.buscando && (
              <p className="text-xs text-muted" aria-live="polite">
                Buscando o endereço do CEP…
              </p>
            )}
            {cepBusca.aviso && <p className="text-xs text-info">{cepBusca.aviso}</p>}
            <Input id="logradouro" name="logradouro" label="Endereço" value={logradouro} onChange={(e) => setLogradouro(e.target.value)} erro={campos.logradouro} />
            <div className="grid grid-cols-2 gap-3">
              <Input id="numero" name="numero" label="Número" value={numero} onChange={(e) => setNumero(e.target.value)} erro={campos.numero} />
              <Input id="complemento" name="complemento" label="Complemento" value={complemento} onChange={(e) => setComplemento(e.target.value)} erro={campos.complemento} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input id="bairro" name="bairro" label="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} erro={campos.bairro} />
              <Input id="cidade" name="cidade" label="Cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} erro={campos.cidade} />
            </div>
          </div>
        </details>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-foreground">Como quer começar?</legend>
        {opcoesDeModo(diasDeTeste).map((opcao) => (
          <label
            key={opcao.valor}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors ${modo === opcao.valor ? "border-primary bg-primary/10" : "border-border bg-surface hover:bg-surface-2"}`}
          >
            <input type="radio" name="modo" value={opcao.valor} checked={modo === opcao.valor} onChange={() => setModo(opcao.valor)} className="mt-0.5 h-4 w-4" />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium text-foreground">{opcao.titulo}</span>
              <span className="text-xs text-muted">{opcao.descricao}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-2 text-sm text-muted">
          <input
            type="checkbox"
            id="aceiteTermos"
            name="aceiteTermos"
            checked={aceiteTermos}
            onChange={(e) => setAceiteTermos(e.target.checked)}
            aria-invalid={campos.aceiteTermos ? true : undefined}
            className={`mt-0.5 h-4 w-4 rounded border-border ${campos.aceiteTermos ? "outline outline-2 outline-danger" : ""}`}
          />
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
        {campos.aceiteTermos && (
          <span role="alert" className="text-xs text-danger">
            {campos.aceiteTermos}
          </span>
        )}
      </div>

      {estadoForm.erroGeral && (
        <div role="alert" className="flex flex-col gap-2 rounded-lg border border-danger bg-danger-bg px-3 py-3 text-sm text-danger">
          <p className="font-medium">{estadoForm.erroGeral}</p>
          {erros.length > 0 && (
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {erros.map((e) => (
                <li key={e.campo}>
                  <a
                    href={`#${e.campo}`}
                    onClick={(ev) => {
                      ev.preventDefault();
                      document.getElementById(e.campo)?.focus();
                    }}
                    className="underline underline-offset-2"
                  >
                    {e.rotulo}
                  </a>
                  : {e.mensagem}
                </li>
              ))}
            </ul>
          )}
          {erros.length === 0 && (
            <p className="flex flex-wrap gap-x-4 gap-y-1">
              <Link href="/login" className="font-medium underline underline-offset-2">
                Entrar na minha conta
              </Link>
              <Link href="/esqueci-senha" className="font-medium underline underline-offset-2">
                Esqueci minha senha
              </Link>
            </p>
          )}
        </div>
      )}

      <Button type="submit" variante="primary" className="w-full shadow-none" aria-busy={emAndamento} disabled={emAndamento}>
        {emAndamento ? "Criando conta…" : modo === "rede" ? "Criar conta grátis" : "Criar conta e começar o teste"}
      </Button>
      <p className="text-center text-xs text-muted">
        {modo === "rede" ? "Grátis, sem prazo. Dá para testar o Elo Gestão depois." : `${diasDeTeste} dias grátis. Sem cartão de crédito.`}
      </p>
      <p className="text-center text-xs text-muted">Telefone e endereço completo você preenche depois, em Configurações.</p>
    </form>
  );
}
