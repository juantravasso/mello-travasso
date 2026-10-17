"use client";

import { useState } from "react";
import type { CompromissoItem } from "@/types";
import { calendarioRepositorio as repo } from "@/services/data";
import { quandoTexto } from "@/lib/calendario/emailLembrete";
import { COR_CATEGORIA, ROTULO_CATEGORIA, ROTULO_STATUS } from "@/lib/calendario/categorias";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

interface Props {
  compromisso: CompromissoItem;
  aoFechar: () => void;
  aoEditar: () => void;
  /** Depois de excluir ou mudar a situação: o pai recarrega a lista. */
  aoAlterar: () => void;
}

const TOM_STATUS = { agendado: "info", concluido: "success", cancelado: "neutral" } as const;

export function DetalheCompromisso({ compromisso: c, aoFechar, aoEditar, aoAlterar }: Props) {
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function executar(acao: () => Promise<{ ok: boolean; mensagem?: string }>) {
    setOcupado(true);
    setErro(null);
    try {
      const r = await acao();
      if (!r.ok) {
        setErro(r.mensagem ?? "Não foi possível concluir.");
        return;
      }
      aoAlterar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  function marcarConcluido() {
    return executar(() =>
      repo.atualizar(c.id, {
        titulo: c.titulo,
        descricao: c.descricao,
        categoria: c.categoria,
        data: c.data,
        diaInteiro: c.diaInteiro,
        horaInicio: c.horaInicio,
        horaFim: c.horaFim,
        status: "concluido",
        participantesIds: c.participantes.map((p) => p.id),
      }),
    );
  }

  return (
    <Modal titulo={c.titulo} onFechar={aoFechar}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${COR_CATEGORIA[c.categoria].chip}`}>{ROTULO_CATEGORIA[c.categoria]}</span>
          <Badge tom={TOM_STATUS[c.status]}>{ROTULO_STATUS[c.status]}</Badge>
        </div>

        <p className="text-base first-letter:uppercase text-foreground">{quandoTexto(c)}</p>

        {c.descricao && <p className="whitespace-pre-line text-sm text-muted">{c.descricao}</p>}

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">Criado por</dt>
          <dd className="text-foreground">{c.souCriador ? "Você" : c.criadoPor.nome}</dd>
          <dt className="text-muted">Compartilhado com</dt>
          <dd className="text-foreground">{c.participantes.length > 0 ? c.participantes.map((p) => p.nome).join(", ") : "Ninguém (só o criador vê)"}</dd>
        </dl>

        {!c.souCriador && <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">Compartilhado com você por {c.criadoPor.nome}. Só quem criou pode alterar ou excluir.</p>}

        {erro && (
          <p role="alert" className="rounded-lg border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
            {erro}
          </p>
        )}

        {c.souCriador &&
          (confirmandoExclusao ? (
            <div className="flex flex-col gap-2 rounded-lg border border-danger bg-danger-bg px-3 py-3 text-sm">
              <p className="text-danger">Excluir este compromisso? Os lembretes que ainda não saíram serão cancelados. Isso não pode ser desfeito.</p>
              <div className="flex gap-2">
                <Button type="button" tamanho="sm" variante="danger" disabled={ocupado} onClick={() => executar(() => repo.excluir(c.id))}>
                  {ocupado ? "Excluindo…" : "Sim, excluir"}
                </Button>
                <Button type="button" tamanho="sm" variante="ghost" disabled={ocupado} onClick={() => setConfirmandoExclusao(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variante="ghost" tamanho="sm" disabled={ocupado} onClick={() => setConfirmandoExclusao(true)}>
                Excluir
              </Button>
              {c.status === "agendado" && (
                <Button type="button" variante="outline" tamanho="sm" disabled={ocupado} onClick={marcarConcluido}>
                  Marcar como concluído
                </Button>
              )}
              <Button type="button" tamanho="sm" disabled={ocupado} onClick={aoEditar}>
                Editar
              </Button>
            </div>
          ))}
      </div>
    </Modal>
  );
}
