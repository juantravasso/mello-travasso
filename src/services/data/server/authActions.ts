"use server";

import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { gerarHash, verificarSenha, verificarSenhaFicticia } from "@/lib/auth/senha";
import { criarSessao, apagarSessaoAtual, apagarOutrasSessoes, limparSessoesExpiradas } from "@/lib/auth/sessao";
import { exigirSessaoAction } from "@/lib/auth/dal";
import { calcularFimDoTeste } from "@/lib/auth/plano";
import { verificarLimite, extrairIpConfiavel, limparLimitesExpirados } from "@/lib/auth/limite";
import { entrarSchema, trocarSenhaSchema } from "@/lib/validacao/auth";
import { criarContaSchema } from "@/lib/validacao/cadastro";
import { normalizarDocumento } from "@/lib/documento";
import { VERSAO_TERMOS_ATUAL } from "@/lib/termos";
import type { ResultadoAction } from "@/types";

const MENSAGEM_CADASTRO_DUPLICADO = "Não foi possível criar a conta com esses dados. Se você já tem conta, entre.";
const LIMITE_CADASTROS_POR_HORA = 3;

const MENSAGEM_LOGIN_INVALIDO = "E-mail ou senha incorretos.";
const MENSAGEM_BLOQUEADO = "Muitas tentativas. Tente de novo em 15 minutos.";
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

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { falhasLogin: 0, bloqueadoAte: null, atualizadoEm: isoAgora() },
  });
  await criarSessao(usuario.id);

  // Empresa só com a rede (plano gratuito) não tem dashboard: entra na rede.
  const empresa = await prisma.empresa.findUnique({ where: { id: usuario.empresaId }, select: { plano: true } });
  const inicio = empresa?.plano === "gratuito" ? "/rede" : "/dashboard";

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
  const sessao = await exigirSessaoAction();

  const parsed = trocarSenhaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: "VALIDACAO", mensagem: "Confira os campos de senha.", campos: formatarErrosZod(parsed) };
  }
  const { senhaAtual, senhaNova } = parsed.data;

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
    data: { senhaHash: novoHash, trocarSenha: false, atualizadoEm: isoAgora() },
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

  const ip = await obterIp();
  const limite = await verificarLimite(`cadastro:ip:${ip}`, LIMITE_CADASTROS_POR_HORA, 60 * 60 * 1000);
  if (!limite.permitido) {
    return { ok: false, erro: "LIMITE", mensagem: "Muitos cadastros a partir deste endereço. Tente de novo mais tarde." };
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
