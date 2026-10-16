"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { SolicitacaoItem, StatusSolicitacao, TipoVerificacao } from "@/types";
import { verificacaoRepositorio as repo } from "@/services/data";
import { enviarDocumento, MAX_DOCUMENTOS_POR_PEDIDO, problemaDoArquivo } from "@/lib/rede/envioDocumento";
import { formatarDataBr } from "@/lib/rede/texto";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DocumentosEscolha } from "./DocumentosEscolha";
import { NovoPedidoForm } from "./NovoPedidoForm";

const STATUS: Record<StatusSolicitacao, { rotulo: string; tom: "info" | "success" | "danger" | "neutral" | "warning" }> = {
  pendente: { rotulo: "Em análise", tom: "info" },
  aprovada: { rotulo: "Aprovado", tom: "success" },
  recusada: { rotulo: "Recusado", tom: "danger" },
  cancelada: { rotulo: "Cancelado", tom: "neutral" },
  expirada: { rotulo: "Expirado", tom: "warning" },
  revogada: { rotulo: "Desfeito", tom: "warning" },
};

function titulo(s: SolicitacaoItem): string {
  const nomes: Record<TipoVerificacao, string> = {
    empresa_verificada: "Selo de verificação",
    reivindicacao_perfil: `Reivindicação do perfil ${s.perfilNome ?? ""}`.trim(),
    relacao_comprovada: `Comprovação de relação com ${s.avaliacao?.perfilNome ?? "o avaliado"}`,
  };
  return nomes[s.tipo];
}

function mensagemDeErro(erro: unknown): string {
  return erro instanceof Error && erro.message && !erro.message.startsWith("NAO_") ? erro.message : "Não foi possível concluir agora. Tente de novo.";
}

function PedidoCard({ pedido, aoMudar }: { pedido: SolicitacaoItem; aoMudar: () => Promise<void> }) {
  const [adicionando, setAdicionando] = useState(false);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const status = STATUS[pedido.status];
  const restante = MAX_DOCUMENTOS_POR_PEDIDO - pedido.documentos;

  async function enviarMais() {
    setOcupado(true);
    setErro(null);
    try {
      for (const arquivo of arquivos) {
        const resultado = await enviarDocumento(pedido.id, arquivo);
        if (!resultado.ok) {
          setErro(`"${arquivo.name}": ${resultado.mensagem}`);
          return;
        }
      }
      setArquivos([]);
      setAdicionando(false);
      await aoMudar();
    } finally {
      setOcupado(false);
    }
  }

  async function cancelar() {
    setOcupado(true);
    setErro(null);
    try {
      const resultado = await repo.cancelar(pedido.id);
      if (!resultado.ok) {
        setErro(resultado.mensagem);
        return;
      }
      await aoMudar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold text-foreground">{titulo(pedido)}</span>
        <Badge tom={status.tom}>{status.rotulo}</Badge>
        <span className="text-xs text-muted">Enviado em {formatarDataBr(pedido.criadoEm)}</span>
      </div>
      {pedido.status === "pendente" && (
        <p className="text-sm text-muted">
          {pedido.documentos === 0
            ? "Sem documento ainda: o pedido só pode ser aprovado com pelo menos um."
            : `${pedido.documentos} ${pedido.documentos === 1 ? "documento enviado" : "documentos enviados"}. A administração responde por aqui e em Notificações.`}
        </p>
      )}
      {pedido.motivoDecisao && pedido.status !== "pendente" && (
        <p className="rounded-lg border-l-2 border-primary bg-surface px-3 py-2 text-sm text-foreground/90">
          <span className="font-medium">Resposta: </span>
          {pedido.motivoDecisao}
        </p>
      )}
      {erro && (
        <p role="alert" className="text-sm text-danger">
          {erro}
        </p>
      )}
      {pedido.status === "pendente" && (
        <div className="flex flex-col gap-3">
          {adicionando && restante > 0 && (
            <div className="flex flex-col gap-3 border-t border-border pt-3">
              <DocumentosEscolha arquivos={arquivos} aoMudar={setArquivos} limite={restante} desabilitado={ocupado} />
              <div className="flex gap-2">
                <Button
                  type="button"
                  tamanho="sm"
                  disabled={ocupado || arquivos.length === 0 || arquivos.some((a) => problemaDoArquivo(a) !== null)}
                  onClick={enviarMais}
                >
                  {ocupado ? "Enviando…" : "Enviar documentos"}
                </Button>
                <Button type="button" tamanho="sm" variante="ghost" onClick={() => { setAdicionando(false); setArquivos([]); }}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {restante > 0 && !adicionando && (
              <Button type="button" tamanho="sm" variante="outline" disabled={ocupado} onClick={() => setAdicionando(true)}>
                Adicionar documentos
              </Button>
            )}
            <Button type="button" tamanho="sm" variante="ghost" disabled={ocupado} onClick={cancelar}>
              Cancelar pedido e apagar documentos
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export function VerificacaoPainel() {
  const [pedidos, setPedidos] = useState<SolicitacaoItem[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);

  const carregar = useCallback(async () => {
    setPedidos(await repo.listarMinhas());
  }, []);

  useEffect(() => {
    carregar().catch((e) => setErro(mensagemDeErro(e)));
  }, [carregar]);

  const temSeloPendente = pedidos?.some((p) => p.tipo === "empresa_verificada" && p.status === "pendente") ?? false;
  const jaVerificada = pedidos?.some((p) => p.tipo === "empresa_verificada" && p.status === "aprovada") ?? false;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">Selo de verificado</h2>
        <p className="text-sm text-muted">
          Uma pessoa da administração confere os seus documentos e, se estiver tudo certo, o selo aparece no seu perfil público. O selo diz que
          os documentos foram conferidos; não é nota de qualidade.
        </p>
        {jaVerificada ? (
          <p className="text-sm font-medium text-foreground">Sua conta já está verificada.</p>
        ) : temSeloPendente ? (
          <p className="text-sm text-muted">Você já tem um pedido em análise (abaixo).</p>
        ) : novo ? (
          <NovoPedidoForm
            pedido={{ tipo: "empresa_verificada" }}
            rotuloEnvio="Enviar pedido de verificação"
            aoConcluir={async () => {
              await carregar();
              setNovo(false);
            }}
            orientacoes={[
              "Empresa: contrato social ou última alteração contratual, e um documento com foto de um sócio ou responsável.",
              "Autônomo: um documento oficial com foto.",
            ]}
          />
        ) : (
          <div>
            <Button type="button" variante="outline" onClick={() => setNovo(true)}>
              Pedir o selo
            </Button>
          </div>
        )}
      </Card>

      <p className="text-sm text-muted">
        Outros pedidos nascem em outro lugar: para <strong className="font-medium text-foreground">reivindicar um perfil indicado</strong>, abra a
        página dele e use &ldquo;É a sua? Reivindique o perfil&rdquo;; para <strong className="font-medium text-foreground">comprovar a relação de uma
        avaliação sua</strong>, use o botão em{" "}
        <Link href="/minha-rede/avaliacoes?aba=feitas" className="font-medium text-primary underline underline-offset-4">
          Avaliações feitas por mim
        </Link>
        .
      </p>

      {erro && (
        <p role="alert" className="rounded-lg border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
          {erro}
        </p>
      )}

      {!pedidos ? (
        <Card className="h-24 animate-pulse bg-surface-2" aria-busy="true">
          {null}
        </Card>
      ) : pedidos.length === 0 ? (
        <Card className="text-sm text-muted">Você ainda não fez nenhum pedido de verificação.</Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {pedidos.map((p) => (
            <li key={p.id}>
              <PedidoCard pedido={p} aoMudar={carregar} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
