"use client";

import { useState } from "react";
import type { Fornecedor, NovoFornecedorInput } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { formatarCpfCnpj } from "@/lib/documento";
import { buscarEmpresaPorCnpj, buscarEnderecoPorCep } from "@/lib/lookupPublico";

interface FornecedorFormProps {
  fornecedor?: Fornecedor;
  onSalvar: (input: NovoFornecedorInput) => Promise<void>;
  onCancelar: () => void;
}

/** Preenche `campo` só se ainda estiver vazio — nunca sobrescreve o que o usuário já digitou. */
function preencherSeVazio(valorAtual: string, valorNovo?: string): string {
  return valorAtual.trim() === "" && valorNovo ? valorNovo : valorAtual;
}

export function FornecedorForm({ fornecedor, onSalvar, onCancelar }: FornecedorFormProps) {
  const [nome, setNome] = useState(fornecedor?.nome ?? "");
  const [documento, setDocumento] = useState(formatarCpfCnpj(fornecedor?.documento));
  const [telefone, setTelefone] = useState(fornecedor?.telefone ?? "");
  const [email, setEmail] = useState(fornecedor?.email ?? "");
  const [cep, setCep] = useState(fornecedor?.cep ?? "");
  const [logradouro, setLogradouro] = useState(fornecedor?.logradouro ?? "");
  const [numero, setNumero] = useState(fornecedor?.numero ?? "");
  const [complemento, setComplemento] = useState(fornecedor?.complemento ?? "");
  const [bairro, setBairro] = useState(fornecedor?.bairro ?? "");
  const [cidade, setCidade] = useState(fornecedor?.cidade ?? "");
  const [estado, setEstado] = useState(fornecedor?.estado ?? "");
  const [observacao, setObservacao] = useState(fornecedor?.observacao ?? "");
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [avisoBusca, setAvisoBusca] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const valido = nome.trim() !== "";

  async function aoSairDoCep() {
    const digitos = cep.replace(/\D/g, "");
    if (digitos.length !== 8) return;
    setBuscandoCep(true);
    setAvisoBusca(null);
    try {
      const endereco = await buscarEnderecoPorCep(cep);
      if (!endereco) {
        setAvisoBusca("CEP não encontrado — preencha o endereço manualmente.");
        return;
      }
      setLogradouro((atual) => preencherSeVazio(atual, endereco.logradouro));
      setBairro((atual) => preencherSeVazio(atual, endereco.bairro));
      setCidade((atual) => preencherSeVazio(atual, endereco.cidade));
      setEstado((atual) => preencherSeVazio(atual, endereco.estado));
    } finally {
      setBuscandoCep(false);
    }
  }

  async function aoSairDoDocumento() {
    const digitos = documento.replace(/\D/g, "");
    setDocumento(formatarCpfCnpj(documento) || documento);
    if (digitos.length !== 14) return; // busca automática só existe para CNPJ (pessoa jurídica)
    setBuscandoCnpj(true);
    setAvisoBusca(null);
    try {
      const empresa = await buscarEmpresaPorCnpj(digitos);
      if (!empresa) {
        setAvisoBusca("CNPJ não encontrado na Receita — preencha os dados manualmente.");
        return;
      }
      setNome((atual) => preencherSeVazio(atual, empresa.nome));
      setTelefone((atual) => preencherSeVazio(atual, empresa.telefone));
      setEmail((atual) => preencherSeVazio(atual, empresa.email));
      setCep((atual) => preencherSeVazio(atual, empresa.cep));
      setLogradouro((atual) => preencherSeVazio(atual, empresa.logradouro));
      setNumero((atual) => preencherSeVazio(atual, empresa.numero));
      setBairro((atual) => preencherSeVazio(atual, empresa.bairro));
      setCidade((atual) => preencherSeVazio(atual, empresa.cidade));
      setEstado((atual) => preencherSeVazio(atual, empresa.estado));
    } finally {
      setBuscandoCnpj(false);
    }
  }

  async function salvar() {
    if (!valido) return;
    setSalvando(true);
    try {
      await onSalvar({
        nome: nome.trim(),
        documento: documento.trim() || undefined,
        telefone: telefone.trim() || undefined,
        email: email.trim() || undefined,
        cep: cep.trim() || undefined,
        logradouro: logradouro.trim() || undefined,
        numero: numero.trim() || undefined,
        complemento: complemento.trim() || undefined,
        bairro: bairro.trim() || undefined,
        cidade: cidade.trim() || undefined,
        estado: estado.trim() || undefined,
        observacao: observacao.trim() || undefined,
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="CNPJ ou CPF"
          value={documento}
          onChange={(e) => setDocumento(e.target.value)}
          onBlur={aoSairDoDocumento}
          placeholder="Buscamos os dados pra você"
        />
        <Input label="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
      </div>
      {buscandoCnpj && <p className="text-xs text-muted">Buscando dados do CNPJ…</p>}
      <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="CEP"
          value={cep}
          onChange={(e) => setCep(e.target.value)}
          onBlur={aoSairDoCep}
          placeholder="Preenche a rua"
        />
        <Input label="Número" value={numero} onChange={(e) => setNumero(e.target.value)} />
      </div>
      {buscandoCep && <p className="text-xs text-muted">Buscando endereço do CEP…</p>}
      {avisoBusca && <p className="text-xs text-info">{avisoBusca}</p>}
      <Input label="Rua/Logradouro" value={logradouro} onChange={(e) => setLogradouro(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} />
        <Input label="Complemento" value={complemento} onChange={(e) => setComplemento(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} />
        <Input label="Estado (UF)" value={estado} maxLength={2} onChange={(e) => setEstado(e.target.value.toUpperCase())} />
      </div>

      <Textarea label="Observação" value={observacao} onChange={(e) => setObservacao(e.target.value)} />

      <div className="flex gap-3 pt-2">
        <Button variante="outline" className="flex-1" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </Button>
        <Button className="flex-1" onClick={salvar} disabled={!valido || salvando}>
          {salvando ? "Salvando…" : "Salvar fornecedor"}
        </Button>
      </div>
    </div>
  );
}
