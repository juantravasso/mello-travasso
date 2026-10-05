"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirRedeAction } from "@/lib/auth/dal";
import { direcaoSchema, idSchema, LIMITES_PORTFOLIO, servicosSchema, trabalhoSchema } from "@/lib/validacao/rede";
import type {
  DirecaoMovimento,
  MeuPortfolio,
  ResultadoAction,
  ServicoInput,
  TrabalhoInput,
} from "@/types";
import { excluirArquivos, MAX_ARQUIVOS_POR_PERFIL, travarPerfil } from "./armazenamento.server";
import { ErroDeNegocio, executar } from "./resultado.server";

// Tudo aqui parte do perfil da empresa da sessão; nenhum id de perfil vem do client.

async function perfilDaSessao(empresaId: string) {
  const perfil = await prisma.perfilPublico.findUnique({ where: { empresaId }, select: { id: true } });
  if (!perfil) throw new ErroDeNegocio("Monte seu perfil antes de cadastrar serviços e trabalhos.");
  return perfil;
}

function primeiroErro(erro: { issues: { message: string }[] }): string {
  return erro.issues[0]?.message ?? "Dados inválidos.";
}

export async function obterMeuPortfolio(): Promise<ResultadoAction<MeuPortfolio>> {
  const sessao = await exigirRedeAction();
  return executar(async () => {
    const perfil = await perfilDaSessao(sessao.empresaId);
    const [servicos, trabalhos, logo, totalArquivos] = await Promise.all([
      prisma.servico.findMany({ where: { perfilId: perfil.id }, orderBy: [{ ordem: "asc" }, { id: "asc" }] }),
      prisma.trabalho.findMany({
        where: { perfilId: perfil.id },
        include: { fotos: { orderBy: [{ ordem: "asc" }, { id: "asc" }], select: { id: true, arquivoId: true } } },
        orderBy: [{ ordem: "asc" }, { id: "asc" }],
      }),
      prisma.arquivo.findFirst({ where: { perfilId: perfil.id, finalidade: "logo" }, orderBy: { criadoEm: "desc" }, select: { id: true } }),
      prisma.arquivo.count({ where: { perfilId: perfil.id } }),
    ]);
    return {
      logoArquivoId: logo?.id,
      servicos: servicos.map((s) => ({ id: s.id, nome: s.nome, descricao: s.descricao ?? undefined })),
      trabalhos: trabalhos.map((t) => ({
        id: t.id,
        titulo: t.titulo,
        descricao: t.descricao ?? undefined,
        servicoId: t.servicoId ?? undefined,
        galeria: t.galeria ?? undefined,
        dataTrabalho: t.dataTrabalho ?? undefined,
        fotos: t.fotos,
      })),
      totalArquivos,
      limites: { ...LIMITES_PORTFOLIO, arquivos: MAX_ARQUIVOS_POR_PERFIL },
    };
  });
}

/** Substitui a lista de serviços (a ordem da lista é a ordem de exibição). Trabalhos ligados a um serviço removido ficam sem serviço. */
export async function salvarServicos(lista: ServicoInput[]): Promise<ResultadoAction<null>> {
  const sessao = await exigirRedeAction();
  return executar(async () => {
    const parsed = servicosSchema.safeParse(lista);
    if (!parsed.success) throw new ErroDeNegocio(primeiroErro(parsed.error));
    const perfil = await perfilDaSessao(sessao.empresaId);

    await prisma.$transaction(async (tx) => {
      await travarPerfil(tx, perfil.id);
      const existentes = await tx.servico.findMany({ where: { perfilId: perfil.id }, select: { id: true } });
      const idsExistentes = new Set(existentes.map((s) => s.id));
      const idsMantidos = new Set<string>();
      const agora = new Date().toISOString();

      for (const [indice, item] of parsed.data.entries()) {
        if (item.id && idsExistentes.has(item.id)) {
          idsMantidos.add(item.id);
          await tx.servico.update({
            where: { id: item.id },
            data: { nome: item.nome, descricao: item.descricao ?? null, ordem: indice },
          });
        } else {
          await tx.servico.create({
            data: { perfilId: perfil.id, nome: item.nome, descricao: item.descricao ?? null, ordem: indice, criadoEm: agora },
          });
        }
      }
      const removidos = existentes.filter((s) => !idsMantidos.has(s.id)).map((s) => s.id);
      if (removidos.length > 0) await tx.servico.deleteMany({ where: { id: { in: removidos }, perfilId: perfil.id } });
    });
    return null;
  });
}

async function validarServico(tx: Prisma.TransactionClient | typeof prisma, perfilId: string, servicoId?: string) {
  if (!servicoId) return;
  const servico = await tx.servico.findFirst({ where: { id: servicoId, perfilId }, select: { id: true } });
  if (!servico) throw new ErroDeNegocio("O serviço escolhido não existe mais.");
}

export async function criarTrabalho(input: TrabalhoInput): Promise<ResultadoAction<{ id: string }>> {
  const sessao = await exigirRedeAction();
  return executar(async () => {
    const parsed = trabalhoSchema.safeParse(input);
    if (!parsed.success) throw new ErroDeNegocio(primeiroErro(parsed.error));
    const perfil = await perfilDaSessao(sessao.empresaId);

    await validarServico(prisma, perfil.id, parsed.data.servicoId);

    const agora = new Date().toISOString();
    const criado = await prisma.$transaction(async (tx) => {
      // O lock serializa criações do mesmo perfil: o limite vale sob concorrência.
      await travarPerfil(tx, perfil.id);
      const total = await tx.trabalho.count({ where: { perfilId: perfil.id } });
      if (total >= LIMITES_PORTFOLIO.trabalhos) {
        throw new ErroDeNegocio(`Você atingiu o limite de ${LIMITES_PORTFOLIO.trabalhos} trabalhos. Exclua algum para criar outro.`);
      }
      const ultimo = await tx.trabalho.findFirst({ where: { perfilId: perfil.id }, orderBy: { ordem: "desc" }, select: { ordem: true } });
      return tx.trabalho.create({
      data: {
        perfilId: perfil.id,
        titulo: parsed.data.titulo,
        descricao: parsed.data.descricao ?? null,
        servicoId: parsed.data.servicoId ?? null,
        galeria: parsed.data.galeria ?? null,
        dataTrabalho: parsed.data.dataTrabalho ?? null,
        ordem: (ultimo?.ordem ?? -1) + 1,
        criadoEm: agora,
        atualizadoEm: agora,
      },
        select: { id: true },
      });
    });
    return { id: criado.id };
  });
}

export async function atualizarTrabalho(id: string, input: TrabalhoInput): Promise<ResultadoAction<null>> {
  const sessao = await exigirRedeAction();
  return executar(async () => {
    const idValido = idSchema.safeParse(id);
    const parsed = trabalhoSchema.safeParse(input);
    if (!idValido.success) throw new ErroDeNegocio("Trabalho não encontrado.");
    if (!parsed.success) throw new ErroDeNegocio(primeiroErro(parsed.error));
    const perfil = await perfilDaSessao(sessao.empresaId);
    await validarServico(prisma, perfil.id, parsed.data.servicoId);

    const atualizados = await prisma.trabalho.updateMany({
      where: { id: idValido.data, perfilId: perfil.id },
      data: {
        titulo: parsed.data.titulo,
        descricao: parsed.data.descricao ?? null,
        servicoId: parsed.data.servicoId ?? null,
        galeria: parsed.data.galeria ?? null,
        dataTrabalho: parsed.data.dataTrabalho ?? null,
        atualizadoEm: new Date().toISOString(),
      },
    });
    if (atualizados.count === 0) throw new ErroDeNegocio("Trabalho não encontrado.");
    return null;
  });
}

export async function excluirTrabalho(id: string): Promise<ResultadoAction<null>> {
  const sessao = await exigirRedeAction();
  return executar(async () => {
    const idValido = idSchema.safeParse(id);
    if (!idValido.success) throw new ErroDeNegocio("Trabalho não encontrado.");
    const perfil = await perfilDaSessao(sessao.empresaId);
    await prisma.$transaction(async (tx) => {
      const trabalho = await tx.trabalho.findFirst({
        where: { id: idValido.data, perfilId: perfil.id },
        select: { id: true, fotos: { select: { arquivoId: true } } },
      });
      if (!trabalho) throw new ErroDeNegocio("Trabalho não encontrado.");
      // Apaga as imagens (que levam as TrabalhoFoto junto) e depois o trabalho.
      await excluirArquivos(tx, trabalho.fotos.map((f) => f.arquivoId), sessao.empresaId);
      await tx.trabalho.delete({ where: { id: trabalho.id } });
    });
    return null;
  });
}

/** Troca de lugar com o vizinho e renumera a lista (as ordens podem ter ficado repetidas). */
async function mover<T extends { id: string }>(
  itens: T[],
  id: string,
  direcao: DirecaoMovimento,
  gravar: (id: string, ordem: number) => Promise<unknown>,
): Promise<void> {
  const indice = itens.findIndex((i) => i.id === id);
  if (indice < 0) throw new ErroDeNegocio("Item não encontrado.");
  const destino = direcao === "subir" ? indice - 1 : indice + 1;
  if (destino < 0 || destino >= itens.length) return;
  const reordenados = [...itens];
  const [movido] = reordenados.splice(indice, 1);
  reordenados.splice(destino, 0, movido!);
  for (const [ordem, item] of reordenados.entries()) await gravar(item.id, ordem);
}

export async function moverTrabalho(id: string, direcao: DirecaoMovimento): Promise<ResultadoAction<null>> {
  const sessao = await exigirRedeAction();
  return executar(async () => {
    const idValido = idSchema.safeParse(id);
    const dir = direcaoSchema.safeParse(direcao);
    if (!idValido.success || !dir.success) throw new ErroDeNegocio("Dados inválidos.");
    const perfil = await perfilDaSessao(sessao.empresaId);
    await prisma.$transaction(async (tx) => {
      const itens = await tx.trabalho.findMany({ where: { perfilId: perfil.id }, orderBy: [{ ordem: "asc" }, { id: "asc" }], select: { id: true } });
      await mover(itens, idValido.data, dir.data, (itemId, ordem) => tx.trabalho.update({ where: { id: itemId }, data: { ordem } }));
    });
    return null;
  });
}

export async function moverFoto(fotoId: string, direcao: DirecaoMovimento): Promise<ResultadoAction<null>> {
  const sessao = await exigirRedeAction();
  return executar(async () => {
    const idValido = idSchema.safeParse(fotoId);
    const dir = direcaoSchema.safeParse(direcao);
    if (!idValido.success || !dir.success) throw new ErroDeNegocio("Dados inválidos.");
    const perfil = await perfilDaSessao(sessao.empresaId);
    await prisma.$transaction(async (tx) => {
      const foto = await tx.trabalhoFoto.findFirst({
        where: { id: idValido.data, trabalho: { perfilId: perfil.id } },
        select: { trabalhoId: true },
      });
      if (!foto) throw new ErroDeNegocio("Foto não encontrada.");
      const itens = await tx.trabalhoFoto.findMany({
        where: { trabalhoId: foto.trabalhoId },
        orderBy: [{ ordem: "asc" }, { id: "asc" }],
        select: { id: true },
      });
      await mover(itens, idValido.data, dir.data, (itemId, ordem) => tx.trabalhoFoto.update({ where: { id: itemId }, data: { ordem } }));
    });
    return null;
  });
}

export async function excluirFoto(fotoId: string): Promise<ResultadoAction<null>> {
  const sessao = await exigirRedeAction();
  return executar(async () => {
    const idValido = idSchema.safeParse(fotoId);
    if (!idValido.success) throw new ErroDeNegocio("Foto não encontrada.");
    const perfil = await perfilDaSessao(sessao.empresaId);
    await prisma.$transaction(async (tx) => {
      const foto = await tx.trabalhoFoto.findFirst({
        where: { id: idValido.data, trabalho: { perfilId: perfil.id } },
        select: { arquivoId: true },
      });
      if (!foto) throw new ErroDeNegocio("Foto não encontrada.");
      await excluirArquivos(tx, [foto.arquivoId], sessao.empresaId);
    });
    return null;
  });
}

export async function removerLogo(): Promise<ResultadoAction<null>> {
  const sessao = await exigirRedeAction();
  return executar(async () => {
    const perfil = await perfilDaSessao(sessao.empresaId);
    await prisma.$transaction(async (tx) => {
      const logos = await tx.arquivo.findMany({ where: { perfilId: perfil.id, finalidade: "logo" }, select: { id: true } });
      await excluirArquivos(tx, logos.map((l) => l.id), sessao.empresaId);
    });
    return null;
  });
}
