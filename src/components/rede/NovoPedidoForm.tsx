"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CriarSolicitacaoInput } from "@/types";
import { verificacaoRepositorio } from "@/services/data";
import { enviarDocumento, problemaDoArquivo } from "@/lib/rede/envioDocumento";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { DocumentosEscolha } from "./DocumentosEscolha";

/**
 * Formulário comum dos três pedidos: cria o pedido e envia os documentos em
 * seguida. Se um envio falhar depois de o pedido existir, o pedido fica
 * pendente e a pessoa completa em "Verificação" (sem perder o que já foi).
 */
export function NovoPedidoForm({
  pedido,
  orientacoes,
  confirmacao,
  rotuloEnvio,
  aoConcluir,
}: {
  pedido: CriarSolicitacaoInput;
  /** O que a pessoa deve anexar. */
  orientacoes: string[];
  /** Se houver, a pessoa precisa marcar esta caixa (ex.: substituição de rascunho). */
  confirmacao?: string;
  rotuloEnvio: string;
  /** Quando o pedido e os documentos foram enviados. Sem isso, vai para a tela de Verificação. */
  aoConcluir?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [observacao, setObservacao] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [ciente, setCiente] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const arquivoRuim = arquivos.some((a) => problemaDoArquivo(a) !== null);
  const podeEnviar = arquivos.length > 0 && !arquivoRuim && (!confirmacao || ciente) && !enviando;

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const criado = await verificacaoRepositorio.criar({ ...pedido, observacao: observacao.trim() || undefined });
      if (!criado.ok) {
        setErro(criado.mensagem);
        return;
      }
      for (const arquivo of arquivos) {
        const resultado = await enviarDocumento(criado.dados.id, arquivo);
        if (!resultado.ok) {
          setErro(`O pedido foi criado, mas "${arquivo.name}" não foi enviado: ${resultado.mensagem} Complete em Verificação.`);
          return;
        }
      }
      if (aoConcluir) {
        await aoConcluir();
      } else {
        router.push("/minha-rede/verificacao");
        router.refresh();
      }
    } catch {
      setErro("Não foi possível enviar agora. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">O que anexar</p>
        <ul className="list-disc pl-5 text-sm text-muted">
          {orientacoes.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </div>

      <DocumentosEscolha arquivos={arquivos} aoMudar={setArquivos} desabilitado={enviando} />

      <Textarea
        id="observacao-pedido"
        label="Recado para a administração (opcional)"
        value={observacao}
        onChange={(e) => setObservacao(e.target.value)}
        maxLength={500}
        rows={3}
      />

      {confirmacao && (
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input type="checkbox" className="mt-1 size-4" checked={ciente} onChange={(e) => setCiente(e.target.checked)} />
          <span>{confirmacao}</span>
        </label>
      )}

      {erro && (
        <p role="alert" className="rounded-lg border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
          {erro}
        </p>
      )}

      <div>
        <Button type="submit" disabled={!podeEnviar} aria-busy={enviando}>
          {enviando ? "Enviando…" : rotuloEnvio}
        </Button>
      </div>
    </form>
  );
}
