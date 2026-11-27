import "server-only";
import { prisma } from "@/lib/prisma";
import { verificarLimite } from "@/lib/auth/limite";
import { dataLocal } from "@/lib/calendario/tempo";
import { formatarNumeroCompra } from "@/lib/compras";
import { urlDoSite } from "@/lib/rede/site";
import { MIMES_DE_FOTO, montarRascunhoDaFoto, RESPOSTAS_FOTO, TAMANHO_MAX_FOTO_BYTES, textoDoRascunho, type ItemDoResumo } from "@/lib/whatsapp/compraPorFoto";
import { FORNECEDOR_NAO_LIDO } from "@/lib/whatsapp/compraPorFoto";
import type { MidiaBaixada } from "@/lib/whatsapp/cliente.server";
import type { MensagemRecebida } from "@/lib/whatsapp/vinculo";
import type { EntradaCompra, ResultadoExtracao, SolicitacaoExtracao } from "@/types";
import { salvarCompra, sugerirIdentificacao } from "./comprasCore.server";
import { garantirDeposito } from "./depositoCore.server";
import { resolverProdutoComTx } from "./estoqueCore.server";
import { registrarEvento } from "./eventosCore.server";
import { autorizarChat, type AutorWhatsapp } from "./whatsappAutor.server";
import { iniciarComprovante } from "./whatsappComprovanteCore.server";

// Foto da nota pelo WhatsApp → rascunho de compra no Depósito. Mesmas barreiras do site (plano com gestão, módulo de
// captura, perfil publicado, fora do somente leitura, limite de leituras por hora) e a MESMA gravação (salvarCompra).
// Nunca efetiva: a pessoa confere e efetiva no app. As dependências externas (baixar, ler com IA, responder) entram
// por parâmetro para o teste de integração rodar sem WhatsApp e sem IA.

/** Mesmo limite da leitura pelo site: as duas contam juntas por empresa. */
const LIMITE_POR_HORA = 30;

export interface DependenciasFoto {
  baixar: (mensagem: MensagemRecebida, limiteBytes: number) => Promise<MidiaBaixada>;
  extrair: (solicitacao: SolicitacaoExtracao) => Promise<ResultadoExtracao>;
  responder: (chatId: string, texto: string) => Promise<void>;
}

export type DesfechoFoto =
  | "nao_vinculado"
  | "sem_acesso"
  | "somente_leitura"
  | "repetida"
  | "limite"
  | "formato"
  | "nao_leu"
  | "rascunho"
  | "pergunta"
  | "falha";

// Número não vinculado NÃO recebe resposta do robô: pode ser alguém falando com o suporte (que é feito por pessoas).
const RESPOSTA_DO_DESFECHO: Partial<Record<DesfechoFoto, string>> = {
  sem_acesso: RESPOSTAS_FOTO.semAcesso,
  somente_leitura: RESPOSTAS_FOTO.somenteLeitura,
  limite: RESPOSTAS_FOTO.limite,
  formato: RESPOSTAS_FOTO.formato,
  nao_leu: RESPOSTAS_FOTO.naoLeu,
  falha: RESPOSTAS_FOTO.falha,
};

/**
 * Liga cada item a um produto do estoque: a memória do fornecedor, o nome igual ou o mais parecido; sem nenhum, cria o
 * produto. Altera `entrada.itens` (produtoId) e devolve, para o resumo, como cada item foi identificado. O "parecido"
 * pode errar (ex.: 50 kg × 25 kg): por isso o resumo pede para conferir, e nada entra no estoque antes de efetivar.
 */
async function identificarItens(autor: AutorWhatsapp, entrada: EntradaCompra): Promise<ItemDoResumo[]> {
  const ctx = { empresaId: autor.empresaId, nome: autor.nome };
  const sugestoes = await sugerirIdentificacao(ctx, { fornecedorNome: entrada.fornecedorNome, itens: entrada.itens.map((i) => ({ descricao: i.descricao })) });
  const resumo: ItemDoResumo[] = [];
  await prisma.$transaction(async (tx) => {
    for (const [i, item] of entrada.itens.entries()) {
      const s = sugestoes[i];
      if (s) {
        item.produtoId = s.produtoId;
        resumo.push({ descricao: item.descricao, produto: s.produtoNome, como: s.motivo === "parecido" ? "parecido" : "existente" });
        continue;
      }
      const criado = await resolverProdutoComTx(tx, autor.empresaId, item.descricao);
      item.produtoId = criado.id;
      resumo.push({ descricao: item.descricao, produto: item.descricao, como: "novo" });
    }
  });
  return resumo;
}

/** Trata uma mensagem com mídia. Devolve o desfecho (para teste e log); a resposta à pessoa já foi enviada. */
export async function processarFotoRecebida(mensagem: MensagemRecebida, deps: DependenciasFoto): Promise<DesfechoFoto> {
  const responder = (texto: string) => deps.responder(mensagem.chatId, texto).catch(() => console.error("[whatsapp/foto] resposta não enviada"));

  const autorizado = await autorizarChat(mensagem.chatId);
  // Sem permitirSomenteLeitura, empresa suspensa já chega como "somente_leitura".
  const autor = autorizado === "suspensa" ? "somente_leitura" : autorizado;
  if (typeof autor === "string") {
    const texto = RESPOSTA_DO_DESFECHO[autor];
    if (texto) await responder(texto);
    return autor;
  }

  // O mesmo webhook pode chegar duas vezes (o WAHA reenvia): a foto só é lida uma vez.
  if (mensagem.mensagemId) {
    const nova = await registrarEvento(prisma, {
      tipo: "whatsapp_foto_recebida",
      empresaId: autor.empresaId,
      usuarioId: autor.usuarioId,
      chave: `whatsapp_foto:${mensagem.mensagemId}`,
    });
    if (!nova) return "repetida";
  }

  if (mensagem.midia?.tipo !== "imagem") {
    await responder(RESPOSTAS_FOTO.formato);
    return "formato";
  }

  const limite = await verificarLimite(`ia-extract:${autor.empresaId}`, LIMITE_POR_HORA, 60 * 60 * 1000);
  if (!limite.permitido) {
    await responder(RESPOSTAS_FOTO.limite);
    return "limite";
  }

  try {
    let midia: MidiaBaixada;
    try {
      midia = await deps.baixar(mensagem, TAMANHO_MAX_FOTO_BYTES);
    } catch (erro) {
      if (erro instanceof Error && "status" in erro && erro.status === 413) {
        await responder(RESPOSTAS_FOTO.formato);
        return "formato";
      }
      throw erro;
    }
    if (!MIMES_DE_FOTO.has(midia.mimetype) || midia.bytes > TAMANHO_MAX_FOTO_BYTES) {
      await responder(RESPOSTAS_FOTO.formato);
      return "formato";
    }

    await responder(RESPOSTAS_FOTO.lendo);
    const leitura = await deps.extrair({ imagemBase64: midia.base64, mimeType: midia.mimetype as SolicitacaoExtracao["mimeType"] });
    const fotoDataUrl = `data:${midia.mimetype};base64,${midia.base64}`;
    const lida = leitura.sucesso && leitura.dados && leitura.dados.confiancaExtracao > 0 ? leitura.dados : null;

    // Comprovante (Pix, transferência): não tem itens; pergunta do que se trata e para qual projeto, depois lança a conta.
    if (lida?.tipoDocumento === "comprovante") {
      const pergunta = await iniciarComprovante(
        autor,
        {
          valor: lida.valor ?? 0,
          data: lida.data && /^\d{4}-\d{2}-\d{2}$/.test(lida.data) ? lida.data : dataLocal(new Date(), autor.fusoHorario),
          favorecido: lida.favorecido?.trim() || FORNECEDOR_NAO_LIDO,
          descricao: lida.descricao,
        },
        fotoDataUrl,
      );
      if (!pergunta) {
        await responder(RESPOSTAS_FOTO.naoLeu);
        return "nao_leu";
      }
      await responder(pergunta);
      return "pergunta";
    }

    const destinoId = await garantirDeposito(autor.empresaId);
    const entrada =
      lida ? montarRascunhoDaFoto(lida, { destinoId, hoje: dataLocal(new Date(), autor.fusoHorario), fotoDataUrl }) : null;
    if (!entrada) {
      await responder(RESPOSTAS_FOTO.naoLeu);
      return "nao_leu";
    }

    const ctx = { empresaId: autor.empresaId, nome: autor.nome };
    const resumoItens = await identificarItens(autor, entrada);

    const compra = await salvarCompra(ctx, entrada);
    const total = Math.round(entrada.itens.reduce((soma, i) => soma + i.valorTotal, 0) * 100) / 100;
    await registrarEvento(prisma, { tipo: "whatsapp_compra_rascunho", empresaId: autor.empresaId, usuarioId: autor.usuarioId, chave: `whatsapp_compra:${compra.id}` });
    await responder(
      textoDoRascunho({
        numero: formatarNumeroCompra(compra.numero),
        fornecedor: entrada.fornecedorNome,
        total,
        destino: "Depósito",
        itens: resumoItens,
        link: `${urlDoSite()}/compras/${compra.id}`,
      }),
    );
    return "rascunho";
  } catch (erro) {
    console.error("[whatsapp/foto] falha:", erro instanceof Error ? erro.name : "erro");
    await responder(RESPOSTAS_FOTO.falha);
    return "falha";
  }
}
