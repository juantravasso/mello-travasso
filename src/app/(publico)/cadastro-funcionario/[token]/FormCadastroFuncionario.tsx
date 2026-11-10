"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";
import { enviarCadastroFuncionario } from "@/services/data/server/conviteFuncionarioActions";

export function FormCadastroFuncionario({
  token,
  empresa,
  nomeSugerido,
  cargoSugerido,
}: {
  token: string;
  empresa: string;
  nomeSugerido?: string;
  cargoSugerido?: string;
}) {
  const [nome, setNome] = useState(nomeSugerido ?? "");
  const [cargo, setCargo] = useState(cargoSugerido ?? "");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [ciente, setCiente] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await enviarCadastroFuncionario(token, { nome, cargo, telefone, email, cpf, ciente });
      if (r.ok) setEnviado(true);
      else setErro(r.mensagem);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div role="status" className="flex flex-col gap-2 rounded-xl border border-success bg-success-bg p-5">
        <h2 className="text-lg font-semibold text-foreground">Cadastro enviado</h2>
        <p className="text-sm text-foreground">
          A {empresa} vai conferir os seus dados e concluir o cadastro. Não precisa fazer mais nada. Este link já foi usado e não abre de novo.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <Input id="func-nome" label="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={160} required autoComplete="name" />
      <Input id="func-cargo" label="Cargo ou função" value={cargo} onChange={(e) => setCargo(e.target.value)} maxLength={160} required />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input id="func-telefone" label="Telefone / WhatsApp (opcional)" type="tel" inputMode="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} maxLength={30} autoComplete="tel" />
        <Input id="func-cpf" label="CPF (opcional)" inputMode="numeric" value={cpf} onChange={(e) => setCpf(e.target.value)} maxLength={14} />
      </div>
      <Input id="func-email" label="E-mail (opcional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={180} autoComplete="email" />

      <label className="flex items-start gap-2 text-sm text-foreground">
        <input type="checkbox" checked={ciente} onChange={(e) => setCiente(e.target.checked)} className="mt-1 h-4 w-4 flex-shrink-0" />
        <span>
          Estou de acordo em enviar estes dados para a {empresa}, que os usará para o meu cadastro como funcionário. Veja a{" "}
          <Link href="/privacidade" target="_blank" className="text-primary underline underline-offset-2">
            Política de Privacidade
          </Link>
          .
        </span>
      </label>

      {erro && (
        <p role="alert" className="text-sm text-danger">
          {erro}
        </p>
      )}

      <Button type="submit" disabled={enviando || !ciente || nome.trim().length < 2 || cargo.trim().length < 2}>
        {enviando ? "Enviando…" : "Enviar meu cadastro"}
      </Button>
    </form>
  );
}
