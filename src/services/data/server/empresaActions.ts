"use server";

import { prisma } from "@/lib/prisma";
import { exigirSessaoAction, obterStatusPlano } from "@/lib/auth/dal";
import { atualizarEmpresaSchema } from "@/lib/validacao/empresa";
import type { StatusPlano } from "@/lib/auth/plano";
import type { EmpresaAtual } from "@/types";

type EmpresaRegistro = {
  id: string;
  documento: string;
  tipoPessoa: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  telefone: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
};

function paraEmpresaAtual(registro: EmpresaRegistro): EmpresaAtual {
  return {
    id: registro.id,
    documento: registro.documento,
    tipoPessoa: registro.tipoPessoa as EmpresaAtual["tipoPessoa"],
    razaoSocial: registro.razaoSocial,
    nomeFantasia: registro.nomeFantasia ?? undefined,
    telefone: registro.telefone ?? undefined,
    cep: registro.cep ?? undefined,
    logradouro: registro.logradouro ?? undefined,
    numero: registro.numero ?? undefined,
    complemento: registro.complemento ?? undefined,
    bairro: registro.bairro ?? undefined,
    cidade: registro.cidade ?? undefined,
    estado: registro.estado ?? undefined,
  };
}

export async function obterEmpresaAtual(): Promise<EmpresaAtual | null> {
  const sessao = await exigirSessaoAction();
  const empresa = await prisma.empresa.findUnique({ where: { id: sessao.empresaId } });
  return empresa ? paraEmpresaAtual(empresa) : null;
}

/** Status do plano para a faixa do teste e /configuracoes (RF-15, RF-20). */
export async function obterStatusPlanoAtual(): Promise<StatusPlano> {
  const sessao = await exigirSessaoAction();
  return obterStatusPlano(sessao.empresaId);
}

/**
 * RF-16: editar o perfil da empresa continua liberado mesmo com o teste
 * encerrado — por isso usa exigirSessaoAction(), não exigirEscritaAction().
 * Mas só o dono (§7 "Autorização por recurso" do PRD) — hoje não há convite
 * de membro, mas o campo já existe no schema; travar agora custa uma linha.
 */
export async function atualizarEmpresaAtual(
  input: unknown,
): Promise<{ ok: true; dados: EmpresaAtual } | { ok: false; mensagem: string }> {
  const sessao = await exigirSessaoAction();
  if (sessao.papel !== "dono") {
    return { ok: false, mensagem: "Só o responsável pela conta pode editar os dados da empresa." };
  }
  const parsed = atualizarEmpresaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, mensagem: "Confira os campos destacados." };
  }

  const registro = await prisma.empresa.update({
    where: { id: sessao.empresaId },
    data: { ...parsed.data, atualizadoEm: new Date().toISOString() },
  });
  return { ok: true, dados: paraEmpresaAtual(registro) };
}
