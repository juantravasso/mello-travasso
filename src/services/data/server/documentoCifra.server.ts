import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Cifra dos documentos de verificação (CNPJ, contrato social, documento do
// responsável) antes de irem ao banco: AES-256-GCM com chave só no ambiente
// (DOCUMENTOS_CHAVE, 32 bytes em base64). Quem lê um dump ou um backup do
// Postgres não consegue abrir nada. O id do arquivo, o pedido e o tipo entram
// como dados autenticados: trocar o conteúdo de uma linha pelo de outra, ou
// mudar o tipo que será servido, faz a decifra falhar.
//
// Formato de `dados`: [versão 1 byte][iv 12][tag 16][conteúdo cifrado].

const VERSAO = 1;
const TAMANHO_IV = 12;
const TAMANHO_TAG = 16;

export interface ContextoDocumento {
  id: string;
  solicitacaoId: string;
  mime: string;
}

function chave(): Buffer | null {
  const bruta = process.env.DOCUMENTOS_CHAVE;
  if (!bruta) return null;
  const k = Buffer.from(bruta, "base64");
  if (k.length !== 32) return null;
  // Chave óbvia (todos os bytes iguais, poucos valores distintos) não é chave: recusa.
  if (new Set(k).size < 16) return null;
  return k;
}

/** Sem a chave (ou com chave fraca ou de tamanho errado), documentos não são aceitos: falha fechada. */
export function cifraDeDocumentosConfigurada(): boolean {
  return chave() !== null;
}

function dadosAutenticados(c: ContextoDocumento): Buffer {
  return Buffer.from(`${c.id}|${c.solicitacaoId}|${c.mime}`);
}

export function cifrarDocumento(conteudo: Uint8Array, contexto: ContextoDocumento): Buffer {
  const k = chave();
  if (!k) throw new Error("DOCUMENTOS_CHAVE ausente ou inválida");
  const iv = randomBytes(TAMANHO_IV);
  const cifra = createCipheriv("aes-256-gcm", k, iv, { authTagLength: TAMANHO_TAG });
  cifra.setAAD(dadosAutenticados(contexto));
  const cifrado = Buffer.concat([cifra.update(conteudo), cifra.final()]);
  return Buffer.concat([Buffer.from([VERSAO]), iv, cifra.getAuthTag(), cifrado]);
}

/** Lança se a chave faltar, o formato for desconhecido ou o conteúdo ou o contexto tiverem sido alterados. */
export function decifrarDocumento(dados: Uint8Array, contexto: ContextoDocumento): Buffer {
  const k = chave();
  if (!k) throw new Error("DOCUMENTOS_CHAVE ausente ou inválida");
  const buffer = Buffer.from(dados);
  if (buffer.length < 1 + TAMANHO_IV + TAMANHO_TAG || buffer[0] !== VERSAO) throw new Error("documento em formato desconhecido");
  const iv = buffer.subarray(1, 1 + TAMANHO_IV);
  const tag = buffer.subarray(1 + TAMANHO_IV, 1 + TAMANHO_IV + TAMANHO_TAG);
  const cifrado = buffer.subarray(1 + TAMANHO_IV + TAMANHO_TAG);
  const decifra = createDecipheriv("aes-256-gcm", k, iv, { authTagLength: TAMANHO_TAG });
  decifra.setAAD(dadosAutenticados(contexto));
  decifra.setAuthTag(tag);
  return Buffer.concat([decifra.update(cifrado), decifra.final()]);
}
