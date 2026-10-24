"use client";

import { useActionState, useState } from "react";
import { atualizarEmpresaAtual } from "@/services/data/server/empresaActions";
import { formatarCep } from "@/lib/cep";
import { formatarCpfCnpj } from "@/lib/documento";
import { useBuscaCep } from "@/hooks/useBuscaCep";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { EmpresaAtual } from "@/types";

interface EstadoEmpresa {
  sucesso?: boolean;
  erroGeral?: string;
}

const ESTADO_INICIAL: EstadoEmpresa = {};

/**
 * RF-20: dados da empresa editáveis, exceto documento. Continua liberado
 * mesmo com o teste encerrado (RF-16) — atualizarEmpresaAtual() usa
 * exigirSessaoAction(), não exigirEscritaAction().
 */
export function EmpresaForm({ empresa }: { empresa: EmpresaAtual }) {
  const [cep, setCep] = useState(formatarCep(empresa.cep ?? ""));
  const [estado, setEstado] = useState(empresa.estado ?? "");
  const [logradouro, setLogradouro] = useState(empresa.logradouro ?? "");
  const [bairro, setBairro] = useState(empresa.bairro ?? "");
  const [cidade, setCidade] = useState(empresa.cidade ?? "");

  // CEP completo → preenche rua, bairro, cidade e UF (número e complemento a pessoa informa).
  const cepBusca = useBuscaCep((e) => {
    setLogradouro((atual) => e.logradouro || atual);
    setBairro((atual) => e.bairro || atual);
    setCidade((atual) => e.cidade || atual);
    setEstado((atual) => e.estado || atual);
  });

  async function acao(_estadoAnterior: EstadoEmpresa, formData: FormData): Promise<EstadoEmpresa> {
    const resultado = await atualizarEmpresaAtual({
      razaoSocial: String(formData.get("razaoSocial") ?? ""),
      nomeFantasia: String(formData.get("nomeFantasia") ?? "") || undefined,
      telefone: String(formData.get("telefone") ?? "") || undefined,
      cep: String(formData.get("cep") ?? "") || undefined,
      logradouro: String(formData.get("logradouro") ?? "") || undefined,
      numero: String(formData.get("numero") ?? "") || undefined,
      complemento: String(formData.get("complemento") ?? "") || undefined,
      bairro: String(formData.get("bairro") ?? "") || undefined,
      cidade: String(formData.get("cidade") ?? "") || undefined,
      estado: String(formData.get("estado") ?? "") || undefined,
    });
    if (!resultado.ok) return { erroGeral: resultado.mensagem };
    return { sucesso: true };
  }

  const [estadoForm, formAction, emAndamento] = useActionState(acao, ESTADO_INICIAL);

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <p className="font-medium text-foreground">Dados da empresa</p>
        <p className="text-sm text-muted">
          {empresa.tipoPessoa === "pj" ? "CNPJ" : "CPF"} {formatarCpfCnpj(empresa.documento)} — não pode ser alterado.
        </p>
      </div>
      <form action={formAction} className="flex flex-col gap-3">
        <Input id="razaoSocial" name="razaoSocial" label={empresa.tipoPessoa === "pj" ? "Razão social" : "Nome completo"} defaultValue={empresa.razaoSocial} required />
        {empresa.tipoPessoa === "pj" && (
          <Input id="nomeFantasia" name="nomeFantasia" label="Nome fantasia" defaultValue={empresa.nomeFantasia ?? ""} />
        )}
        <Input id="telefone" name="telefone" label="Telefone" defaultValue={empresa.telefone ?? ""} />
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
          />
          <Input id="estado" name="estado" label="UF" maxLength={2} value={estado} onChange={(e) => setEstado(e.target.value.toUpperCase())} />
        </div>
        {cepBusca.buscando && (
          <p className="text-xs text-muted" aria-live="polite">
            Buscando o endereço do CEP…
          </p>
        )}
        {cepBusca.aviso && <p className="text-xs text-info">{cepBusca.aviso}</p>}
        <Input id="logradouro" name="logradouro" label="Endereço" value={logradouro} onChange={(e) => setLogradouro(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input id="numero" name="numero" label="Número" defaultValue={empresa.numero ?? ""} />
          <Input id="complemento" name="complemento" label="Complemento" defaultValue={empresa.complemento ?? ""} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input id="bairro" name="bairro" label="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} />
          <Input id="cidade" name="cidade" label="Cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} />
        </div>

        {estadoForm.erroGeral && (
          <p role="alert" className="text-sm text-danger">
            {estadoForm.erroGeral}
          </p>
        )}
        {estadoForm.sucesso && (
          <p role="status" className="text-sm text-success">
            Dados salvos.
          </p>
        )}

        <Button type="submit" variante="secondary" aria-busy={emAndamento} disabled={emAndamento}>
          {emAndamento ? "Salvando…" : "Salvar dados da empresa"}
        </Button>
      </form>
    </Card>
  );
}
