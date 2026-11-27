import "server-only";
import { prisma } from "@/lib/prisma";
import { obterRecursosDaEmpresa, obterStatusPlano, perfilObrigatorioPendente } from "@/lib/auth/acessoEmpresa.server";
import { ACESSO, normalizarModulos, temAlgumModulo, TODOS_OS_MODULOS, type AcessoDaPessoa, type ModuloChave } from "@/lib/auth/modulos";

// Quem está falando pelo WhatsApp e se pode lançar: as MESMAS barreiras de quem lança pelo site (plano com gestão, módulo
// de captura ou dono, perfil publicado, fora do somente leitura, usuário e empresa não bloqueados). Usado pela foto da
// nota e pela conversa do comprovante, e conferido de novo a cada passo (a permissão pode mudar no meio da conversa).

export interface AutorWhatsapp {
  usuarioId: string;
  nome: string;
  empresaId: string;
  fusoHorario: string;
  /** Papel e módulos, para as regras que conferem o acesso por tipo (contas a pagar x a receber). */
  pessoa: AcessoDaPessoa;
  /** Só aparece true quando a chamada aceitou leitura (`permitirSomenteLeitura`): consulta sim, lançamento não. */
  somenteLeitura: boolean;
}

export interface OpcoesAutorizacao {
  /** Módulos que liberam (basta um). Padrão: os de lançar comprovante. */
  modulos?: readonly ModuloChave[];
  /**
   * Consultas valem mesmo com o teste vencido (somente leitura): devolve o autor com `somenteLeitura`. Assinatura
   * SUSPENSA não: o assistente usa IA paga e fica fora até regularizar ("suspensa").
   */
  permitirSomenteLeitura?: boolean;
}

export type NegadoWhatsapp = "nao_vinculado" | "sem_acesso" | "somente_leitura" | "suspensa";

export async function autorizarChat(chatId: string, opcoes: OpcoesAutorizacao = {}): Promise<AutorWhatsapp | NegadoWhatsapp> {
  const vinculo = await prisma.vinculoWhatsapp.findUnique({
    where: { chatId },
    include: { usuario: { include: { empresa: { select: { bloqueadaEm: true, fusoHorario: true } } } } },
  });
  if (!vinculo?.verificadoEm) return "nao_vinculado";
  const u = vinculo.usuario;
  if (u.bloqueadoPlataformaEm || u.desativadoEm || u.empresa.bloqueadaEm || u.trocarSenha) return "sem_acesso";

  const pessoa: AcessoDaPessoa = { papel: u.papel, modulos: u.papel === "dono" ? TODOS_OS_MODULOS : normalizarModulos(u.modulos) };
  const recursos = await obterRecursosDaEmpresa(u.empresaId);
  if (!recursos.has("gestao") || !temAlgumModulo(pessoa, opcoes.modulos ?? ACESSO.leituraDeComprovante)) return "sem_acesso";
  if (await perfilObrigatorioPendente(u.empresaId, u.papel, u.papelPlataforma === "admin")) return "sem_acesso";
  const status = await obterStatusPlano(u.empresaId);
  const somenteLeitura = status.somenteLeitura;
  if (somenteLeitura && !opcoes.permitirSomenteLeitura) return "somente_leitura";
  if (opcoes.permitirSomenteLeitura && status.plano === "suspenso") return "suspensa";
  return { usuarioId: u.id, nome: u.nome, empresaId: u.empresaId, fusoHorario: u.empresa.fusoHorario, pessoa, somenteLeitura };
}
