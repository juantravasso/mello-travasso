import "server-only";
import { prisma } from "@/lib/prisma";
import { obterRecursosDaEmpresa, obterStatusPlano, perfilObrigatorioPendente } from "@/lib/auth/acessoEmpresa.server";
import { ACESSO, normalizarModulos, temAlgumModulo, TODOS_OS_MODULOS } from "@/lib/auth/modulos";

// Quem está falando pelo WhatsApp e se pode lançar: as MESMAS barreiras de quem lança pelo site (plano com gestão, módulo
// de captura ou dono, perfil publicado, fora do somente leitura, usuário e empresa não bloqueados). Usado pela foto da
// nota e pela conversa do comprovante, e conferido de novo a cada passo (a permissão pode mudar no meio da conversa).

export interface AutorWhatsapp {
  usuarioId: string;
  nome: string;
  empresaId: string;
  fusoHorario: string;
}

export type NegadoWhatsapp = "nao_vinculado" | "sem_acesso" | "somente_leitura";

export async function autorizarChat(chatId: string): Promise<AutorWhatsapp | NegadoWhatsapp> {
  const vinculo = await prisma.vinculoWhatsapp.findUnique({
    where: { chatId },
    include: { usuario: { include: { empresa: { select: { bloqueadaEm: true, fusoHorario: true } } } } },
  });
  if (!vinculo?.verificadoEm) return "nao_vinculado";
  const u = vinculo.usuario;
  if (u.bloqueadoPlataformaEm || u.desativadoEm || u.empresa.bloqueadaEm || u.trocarSenha) return "sem_acesso";

  const pessoa = { papel: u.papel, modulos: u.papel === "dono" ? TODOS_OS_MODULOS : normalizarModulos(u.modulos) };
  const recursos = await obterRecursosDaEmpresa(u.empresaId);
  if (!recursos.has("gestao") || !temAlgumModulo(pessoa, ACESSO.leituraDeComprovante)) return "sem_acesso";
  if (await perfilObrigatorioPendente(u.empresaId, u.papel, u.papelPlataforma === "admin")) return "sem_acesso";
  if ((await obterStatusPlano(u.empresaId)).somenteLeitura) return "somente_leitura";
  return { usuarioId: u.id, nome: u.nome, empresaId: u.empresaId, fusoHorario: u.empresa.fusoHorario };
}
