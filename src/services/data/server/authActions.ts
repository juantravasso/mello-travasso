"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { gerarHash, verificarSenha, verificarSenhaFicticia } from "@/lib/auth/senha";
import { criarSessao, apagarSessaoAtual, apagarOutrasSessoes, limparSessoesExpiradas } from "@/lib/auth/sessao";
import { exigirSessaoAction, obterRecursosDaEmpresa } from "@/lib/auth/dal";
import { calcularFimDoTeste } from "@/lib/auth/plano";
import { verificarLimite, extrairIpConfiavel, limparLimitesExpirados } from "@/lib/auth/limite";
import { entrarSchema, trocarSenhaSchema } from "@/lib/validacao/auth";
import { criarContaSchema } from "@/lib/validacao/cadastro";
import { normalizarDocumento } from "@/lib/documento";
import { normalizarModulos, primeiraRotaPermitida, TODOS_OS_MODULOS } from "@/lib/auth/modulos";
import { MARCA } from "@/lib/marca";
import { VERSAO_TERMOS_ATUAL } from "@/lib/termos";
import type { ResultadoAction } from "@/types";
import { emitirConfirmacaoDeEmail } from "./emailConfirmacao.server";

const MENSAGEM_CADASTRO_DUPLICADO = "Não foi possível criar a conta com esses dados. Se você já tem conta, entre.";
const LIMITE_CADASTROS_POR_HORA = 5;

const MENSAGEM_LOGIN_INVALIDO = "E-mail ou senha incorretos.";
const MENSAGEM_BLOQUEADO = "Muitas tentativas. Tente de novo em 15 minutos.";
const MENSAGEM_CONTA_BLOQUEADA = `Esta conta está bloqueada. Fale com o suporte: ${MARCA.emailContato}.`;
const MAX_FALHAS = 5;
const BLOQUEIO_MS = 15 * 60 * 1000;

function isoAgora(): string {
  return new Date().toISOString();
}

async function obterIp(): Promise<string> {
  return extrairIpConfiavel(await headers());
}

export async function entrar(input: unknown): Promise<ResultadoAction<{ redirecionarPara: string; trocaObrigatoria: boolean }>> {
  const parsed = entrarSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: "VALIDACAO", mensagem: "Preencha e-mail e senha.", campos: formatarErrosZod(parsed) };
  }
  const { email, senha } = parsed.data;
  const ip = await obterIp();

  // Limpeza oportunista (PRD §7, LGPD/Retenção) — não é um job agendado, só
  // uma chance pequena a cada login de não deixar sessões/janelas vencidas
  // se acumularem para sempre. Serverless não tem cron nativo sem custo
  // extra; isto é suficiente para o volume deste app.
  if (Math.random() < 0.01) {
    await Promise.all([limparSessoesExpiradas(), limparLimitesExpirados()]);
  }

  const limitePorConta = await verificarLimite(`login:${email}:${ip}`, MAX_FALHAS, 60_000);
  const limitePorIp = await verificarLimite(`login:ip:${ip}`, 20, 60_000);
  if (!limitePorConta.permitido || !limitePorIp.permitido) {
    return { ok: false, erro: "LIMITE", mensagem: MENSAGEM_BLOQUEADO };
  }

  const usuario = await prisma.usuario.findUnique({ where: { email } });

  if (!usuario) {
    await verificarSenhaFicticia(senha);
    return { ok: false, erro: "VALIDACAO", mensagem: MENSAGEM_LOGIN_INVALIDO };
  }

  if (usuario.bloqueadoAte && new Date(usuario.bloqueadoAte).getTime() > Date.now()) {
    await verificarSenhaFicticia(senha);
    return { ok: false, erro: "LIMITE", mensagem: MENSAGEM_BLOQUEADO };
  }

  const senhaOk = await verificarSenha(senha, usuario.senhaHash);

  if (!senhaOk) {
    // RF-10: "5 falhas em 15 min". Sem uma janela, falhas antigas nunca
    // expirariam sozinhas — ultimaFalhaLoginEm (só gravado aqui, nunca em
    // login OK ou troca de senha) marca a última falha: se ela é mais antiga
    // que 15 min, a série reinicia em 1 em vez de continuar somando.
    const ultimaFalhaDentroDaJanela = usuario.ultimaFalhaLoginEm
      ? Date.now() - new Date(usuario.ultimaFalhaLoginEm).getTime() < BLOQUEIO_MS
      : false;
    const novasFalhas = ultimaFalhaDentroDaJanela ? usuario.falhasLogin + 1 : 1;
    const bloqueadoAte = novasFalhas >= MAX_FALHAS ? new Date(Date.now() + BLOQUEIO_MS).toISOString() : null;
    const agora = isoAgora();
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { falhasLogin: bloqueadoAte ? 0 : novasFalhas, bloqueadoAte, ultimaFalhaLoginEm: agora, atualizadoEm: agora },
    });
    return {
      ok: false,
      erro: bloqueadoAte ? "LIMITE" : "VALIDACAO",
      mensagem: bloqueadoAte ? MENSAGEM_BLOQUEADO : MENSAGEM_LOGIN_INVALIDO,
    };
  }

  // Bloqueio da administração (usuário ou empresa). Só depois de a senha conferir: quem erra a
  // senha recebe a resposta de sempre, então a mensagem não serve para descobrir contas.
  const empresa = await prisma.empresa.findUnique({ where: { id: usuario.empresaId }, select: { plano: true, bloqueadaEm: true } });
  if (usuario.bloqueadoPlataformaEm || empresa?.bloqueadaEm) {
    return { ok: false, erro: "VALIDACAO", mensagem: MENSAGEM_CONTA_BLOQUEADA };
  }
  // Usuário desativado ou com a senha temporária vencida: também só depois de a senha conferir.
  if (usuario.desativadoEm) {
    return { ok: false, erro: "VALIDACAO", mensagem: "Esta conta foi desativada. Fale com o responsável pela sua empresa." };
  }
  if (usuario.trocarSenha && usuario.senhaTemporariaExpiraEm && new Date(usuario.senhaTemporariaExpiraEm).getTime() <= Date.now()) {
    return {
      ok: false,
      erro: "VALIDACAO",
      mensagem: "A senha temporária venceu. Peça ao responsável pela sua empresa para redefinir o seu acesso.",
    };
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { falhasLogin: 0, bloqueadoAte: null, atualizadoEm: isoAgora() },
  });
  await criarSessao(usuario.id);

  // Empresa só com a rede (plano gratuito) não tem dashboard: entra na rede.
  // O funcionário começa no primeiro módulo que o dono liberou para ele (o dono, no dashboard).
  const recursos = await obterRecursosDaEmpresa(usuario.empresaId);
  const pessoa = { papel: usuario.papel, modulos: usuario.papel === "dono" ? TODOS_OS_MODULOS : normalizarModulos(usuario.modulos) };
  const inicio = empresa?.plano === "gratuito" ? "/rede" : primeiraRotaPermitida(pessoa, recursos);

  return {
    ok: true,
    dados: {
      redirecionarPara: usuario.trocarSenha ? "/configuracoes?trocarSenha=1" : inicio,
      trocaObrigatoria: usuario.trocarSenha,
    },
  };
}

export async function sair(): Promise<ResultadoAction<null>> {
  await apagarSessaoAtual();
  return { ok: true, dados: null };
}

export async function trocarSenha(input: unknown): Promise<ResultadoAction<null>> {
  // É a única ação que passa com a troca de senha pendente.
  const sessao = await exigirSessaoAction({ permitirTrocaPendente: true });

  const parsed = trocarSenhaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: "VALIDACAO", mensagem: "Confira os campos de senha.", campos: formatarErrosZod(parsed) };
  }
  const { senhaAtual, senhaNova } = parsed.data;
  if (senhaNova === senhaAtual) {
    return { ok: false, erro: "VALIDACAO", mensagem: "A nova senha precisa ser diferente da atual.", campos: { senhaNova: "A nova senha precisa ser diferente da atual." } };
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: sessao.usuarioId } });
  if (!usuario) {
    // Sessão válida mas o usuário não existe mais (registro apagado) — caso
    // raro, mas a mensagem de login não faz sentido neste fluxo autenticado.
    return { ok: false, erro: "NAO_AUTENTICADO", mensagem: "Não foi possível confirmar sua conta. Entre novamente." };
  }

  const senhaAtualOk = await verificarSenha(senhaAtual, usuario.senhaHash);
  if (!senhaAtualOk) {
    return { ok: false, erro: "VALIDACAO", mensagem: "Senha atual incorreta.", campos: { senhaAtual: "Senha atual incorreta." } };
  }

  const novoHash = await gerarHash(senhaNova);
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { senhaHash: novoHash, trocarSenha: false, senhaTemporariaExpiraEm: null, atualizadoEm: isoAgora() },
  });
  await apagarOutrasSessoes(usuario.id);

  return { ok: true, dados: null };
}

export async function criarConta(
  input: unknown,
): Promise<ResultadoAction<{ redirecionarPara: string; trocaObrigatoria: boolean }>> {
  // RF-21: campo honeypot preenchido → sucesso falso, sem tocar o banco nem
  // revelar ao bot que foi identificado. Checado antes do schema (que não
  // valida o conteúdo desse campo, só a forma) e antes do rate limit (não
  // gasta a cota de um IP legítimo com tentativas de bot).
  if (input && typeof input === "object" && "empresaConfirmacao" in input) {
    const honeypot = (input as Record<string, unknown>).empresaConfirmacao;
    if (typeof honeypot === "string" && honeypot.trim() !== "") {
      return { ok: true, dados: { redirecionarPara: "/dashboard", trocaObrigatoria: false } };
    }
  }

  const parsed = criarContaSchema.safeParse(input);
  if (!parsed.success) {
    const documentoInvalido = parsed.error.issues.some((i) => i.path[0] === "documento");
    const dados = input as Record<string, unknown>;
    const mensagemDocumento =
      typeof dados?.tipoPessoa === "string" && dados.tipoPessoa === "pf"
        ? "CPF inválido — confira os 11 dígitos"
        : "CNPJ inválido — confira os 14 dígitos";
    const campos = formatarErrosZod(parsed);
    if (documentoInvalido) campos.documento = mensagemDocumento;
    return { ok: false, erro: "VALIDACAO", mensagem: "Confira os campos destacados.", campos };
  }
  // O limite vem depois da validação de formato: erro de digitação (CNPJ, CEP, campo vazio) não gasta
  // tentativa. Continua antes de qualquer consulta ao banco, que é o que revelaria se um documento
  // ou e-mail já tem conta.
  const ip = await obterIp();
  const limite = await verificarLimite(`cadastro:ip:${ip}`, LIMITE_CADASTROS_POR_HORA, 60 * 60 * 1000);
  if (!limite.permitido) {
    return { ok: false, erro: "LIMITE", mensagem: "Muitos cadastros a partir deste endereço. Tente de novo mais tarde." };
  }

  const dadosForm = parsed.data;
  const documentoNormalizado = normalizarDocumento(dadosForm.documento);
  if (!documentoNormalizado) {
    return { ok: false, erro: "VALIDACAO", mensagem: "Documento inválido." };
  }

  // Checagem combinada antes de gastar o hash/transação: consultar as duas
  // unicidades em paralelo e responder a mesma mensagem/tempo para as duas
  // evita que alguém meça a diferença de tempo entre "documento existe" e
  // "e-mail existe" (a transação abaixo cria Empresa antes de Usuario, então
  // sem isso as duas falhas teriam latências bem diferentes). A unique
  // constraint do Postgres continua sendo a rede de segurança real contra
  // corrida — isto aqui só cobre o caso comum, sem tempo desigual.
  const [documentoExistente, emailExistente] = await Promise.all([
    prisma.empresa.findUnique({ where: { documento: documentoNormalizado }, select: { id: true } }),
    prisma.usuario.findUnique({ where: { email: dadosForm.email }, select: { id: true } }),
  ]);
  if (documentoExistente || emailExistente) {
    return { ok: false, erro: "VALIDACAO", mensagem: MENSAGEM_CADASTRO_DUPLICADO };
  }

  const senhaHash = await gerarHash(dadosForm.senha);
  const agora = isoAgora();
  const soRede = dadosForm.modo === "rede";
  const testeTerminaEm = soRede ? null : calcularFimDoTeste();

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const empresa = await tx.empresa.create({
        data: {
          documento: documentoNormalizado,
          razaoSocial: dadosForm.razaoSocial,
          nomeFantasia: dadosForm.nomeFantasia,
          tipoPessoa: dadosForm.tipoPessoa,
          situacaoCadastral: dadosForm.situacaoCadastral,
          telefone: dadosForm.telefone,
          emailContato: dadosForm.email,
          cep: dadosForm.cep,
          logradouro: dadosForm.logradouro,
          numero: dadosForm.numero,
          complemento: dadosForm.complemento,
          bairro: dadosForm.bairro,
          cidade: dadosForm.cidade,
          estado: dadosForm.estado,
          plano: soRede ? "gratuito" : "teste",
          testeTerminaEm,
          aceiteTermosVersao: VERSAO_TERMOS_ATUAL,
          aceiteTermosEm: agora,
          criadoEm: agora,
          atualizadoEm: agora,
        },
      });
      const usuario = await tx.usuario.create({
        data: {
          empresaId: empresa.id,
          nome: dadosForm.nomeUsuario,
          email: dadosForm.email,
          senhaHash,
          papel: "dono",
          criadoEm: agora,
          atualizadoEm: agora,
        },
      });
      return usuario;
    });

    await criarSessao(resultado.id);
    // Confirmação de e-mail depois da resposta: o tempo do envio não pode distinguir "conta criada"
    // de "cadastro duplicado" (que responde sem enviar). Falha de envio não derruba o cadastro: há reenvio no app.
    const paraConfirmar = { id: resultado.id, nome: resultado.nome, email: resultado.email };
    after(() =>
      emitirConfirmacaoDeEmail(paraConfirmar).catch((e) => {
        console.error("[auth] falha ao emitir confirmação de e-mail:", e instanceof Error ? e.name : "erro");
      }),
    );
    return {
      ok: true,
      dados: { redirecionarPara: soRede ? "/minha-rede/perfil" : "/dashboard", trocaObrigatoria: false },
    };
  } catch (erro) {
    // RF-06: documento ou e-mail já cadastrados (unique constraint) viram a
    // mesma mensagem genérica das duas — nunca dizer qual colidiu.
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      return { ok: false, erro: "VALIDACAO", mensagem: MENSAGEM_CADASTRO_DUPLICADO };
    }
    throw erro;
  }
}

function formatarErrosZod(parsed: { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } }) {
  const campos: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const chave = String(issue.path[0] ?? "form");
    if (!campos[chave]) campos[chave] = issue.message;
  }
  return campos;
}
