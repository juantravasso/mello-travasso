"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirGestaoAction, exigirGestaoEscritaAction } from "@/lib/auth/dal";
import { ACESSO, CHAVES_MODULO, normalizarModulos } from "@/lib/auth/modulos";
import type { CargoItem, ListaCargos, ResultadoAction } from "@/types";
import { ErroDeNegocio, executar } from "./resultado.server";
import { modulosDaEmpresa } from "./usuariosEmpresaCore.server";

// Cargos e funções da empresa. O cargo só define quais módulos vêm marcados ao dar acesso a um funcionário; o dono
// ainda ajusta os módulos de cada pessoa. Ver a lista exige o módulo Funcionários; criar e editar é só do dono.

const salvarSchema = z
  .object({
    id: z.string().uuid().optional(),
    nome: z.string().trim().min(2, "Dê um nome ao cargo (ao menos 2 letras).").max(80, "Nome muito longo."),
    modulos: z.array(z.enum(CHAVES_MODULO as [string, ...string[]])).max(CHAVES_MODULO.length),
  })
  .strict();

function paraCargo(c: { id: string; nome: string; modulos: string[] }): CargoItem {
  return { id: c.id, nome: c.nome, modulos: normalizarModulos(c.modulos) };
}

export async function listarCargos(): Promise<ResultadoAction<ListaCargos>> {
  return executar(async () => {
    const sessao = await exigirGestaoAction(...ACESSO.funcionariosLer);
    const [cargos, modulosDisponiveis] = await Promise.all([
      prisma.cargo.findMany({ where: { empresaId: sessao.empresaId }, orderBy: { nome: "asc" } }),
      modulosDaEmpresa(sessao.empresaId),
    ]);
    return { cargos: cargos.map(paraCargo), modulosDisponiveis };
  });
}

export async function salvarCargo(entrada: { id?: string; nome: string; modulos: string[] }): Promise<ResultadoAction<CargoItem>> {
  return executar(async () => {
    const sessao = await exigirGestaoEscritaAction(...ACESSO.funcionariosEscrever);
    if (sessao.papel !== "dono") throw new ErroDeNegocio("Só o dono da empresa cria e edita cargos.");
    const parsed = salvarSchema.safeParse(entrada);
    if (!parsed.success) throw new ErroDeNegocio(parsed.error.issues[0]?.message ?? "Dados inválidos.");

    // O cargo só pode liberar o que o plano da empresa permite.
    const disponiveis = await modulosDaEmpresa(sessao.empresaId);
    const modulos = normalizarModulos(parsed.data.modulos).filter((m) => disponiveis.includes(m));
    const agora = new Date().toISOString();
    try {
      if (parsed.data.id) {
        const existente = await prisma.cargo.findFirst({ where: { id: parsed.data.id, empresaId: sessao.empresaId } });
        if (!existente) throw new ErroDeNegocio("Cargo não encontrado.");
        const [atualizado] = await prisma.$transaction([
          prisma.cargo.update({ where: { id: existente.id }, data: { nome: parsed.data.nome, modulos, atualizadoEm: agora } }),
          // Funcionários que já têm este cargo escrito na ficha acompanham o novo nome.
          prisma.funcionario.updateMany({ where: { empresaId: sessao.empresaId, cargo: existente.nome }, data: { cargo: parsed.data.nome, atualizadoEm: agora } }),
        ]);
        return paraCargo(atualizado);
      }
      const criado = await prisma.cargo.create({ data: { empresaId: sessao.empresaId, nome: parsed.data.nome, modulos, criadoEm: agora, atualizadoEm: agora } });
      return paraCargo(criado);
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") throw new ErroDeNegocio("Já existe um cargo com esse nome.");
      throw erro;
    }
  });
}
