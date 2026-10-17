"use client";

import { useState } from "react";
import type { CompromissoItem, EntradaCompromisso } from "@/types";
import { calendarioRepositorio as repo } from "@/services/data";
import { CATEGORIAS, ROTULO_CATEGORIA, ROTULO_STATUS, STATUS_COMPROMISSO, type CategoriaCompromisso, type StatusCompromisso } from "@/lib/calendario/categorias";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { SeletorParticipantes } from "./SeletorParticipantes";

interface Props {
  /** Compromisso em edição; ausente = criação. */
  existente?: CompromissoItem;
  /** Data sugerida em uma criação (o dia que o usuário estava olhando). */
  dataInicial: string;
  aoFechar: () => void;
  aoSalvar: (c: CompromissoItem) => void;
}

/** Mesma regra do servidor, para avisar antes de enviar: o servidor continua sendo quem decide. */
function validar(f: { titulo: string; data: string; diaInteiro: boolean; horaInicio: string; horaFim: string }): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!f.titulo.trim()) erros.titulo = "Informe o título do compromisso";
  if (!f.data) erros.data = "Informe a data";
  if (!f.diaInteiro) {
    if (!f.horaInicio) erros.horaInicio = "Informe o horário de início";
    else if (f.horaFim && f.horaFim <= f.horaInicio) erros.horaFim = "O término precisa ser depois do início";
  }
  return erros;
}

export function CompromissoModal({ existente, dataInicial, aoFechar, aoSalvar }: Props) {
  const [titulo, setTitulo] = useState(existente?.titulo ?? "");
  const [descricao, setDescricao] = useState(existente?.descricao ?? "");
  const [categoria, setCategoria] = useState<CategoriaCompromisso>(existente?.categoria ?? "reuniao");
  const [status, setStatus] = useState<StatusCompromisso>(existente?.status ?? "agendado");
  const [data, setData] = useState(existente?.data ?? dataInicial);
  const [diaInteiro, setDiaInteiro] = useState(existente?.diaInteiro ?? false);
  const [horaInicio, setHoraInicio] = useState(existente?.horaInicio ?? "09:00");
  const [horaFim, setHoraFim] = useState(existente?.horaFim ?? "10:00");
  const [participantes, setParticipantes] = useState<string[]>(existente?.participantes.map((p) => p.id) ?? []);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    const encontrados = validar({ titulo, data, diaInteiro, horaInicio, horaFim });
    setErros(encontrados);
    setErroGeral(null);
    if (Object.keys(encontrados).length > 0) return;

    const entrada: EntradaCompromisso = {
      titulo: titulo.trim(),
      descricao: descricao.trim() || undefined,
      categoria,
      data,
      diaInteiro,
      horaInicio: diaInteiro ? undefined : horaInicio,
      horaFim: diaInteiro || !horaFim ? undefined : horaFim,
      status,
      participantesIds: participantes,
    };
    setSalvando(true);
    try {
      const resultado = existente ? await repo.atualizar(existente.id, entrada) : await repo.criar(entrada);
      if (!resultado.ok) {
        setErroGeral(resultado.mensagem);
        return;
      }
      aoSalvar(resultado.dados);
    } catch (e) {
      setErroGeral(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo={existente ? "Editar compromisso" : "Novo compromisso"} onFechar={aoFechar} tamanho="lg">
      <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
        <Input id="cal-titulo" label="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} erro={erros.titulo} autoFocus />

        <div className="grid gap-3 sm:grid-cols-2">
          <Select id="cal-categoria" label="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaCompromisso)}>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {ROTULO_CATEGORIA[c]}
              </option>
            ))}
          </Select>
          {existente && (
            <Select id="cal-status" label="Situação" value={status} onChange={(e) => setStatus(e.target.value as StatusCompromisso)}>
              {STATUS_COMPROMISSO.map((s) => (
                <option key={s} value={s}>
                  {ROTULO_STATUS[s]}
                </option>
              ))}
            </Select>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Input id="cal-data" label="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} erro={erros.data} />
          {!diaInteiro && (
            <>
              <Input id="cal-inicio" label="Início" type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} erro={erros.horaInicio} />
              <Input id="cal-fim" label="Término (opcional)" type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} erro={erros.horaFim} />
            </>
          )}
        </div>
        <label className="flex min-h-11 w-fit cursor-pointer items-center gap-3 text-sm text-foreground">
          <input type="checkbox" checked={diaInteiro} onChange={(e) => setDiaInteiro(e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />
          Dia inteiro
        </label>

        <Textarea id="cal-descricao" label="Descrição (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={2000} />

        <SeletorParticipantes selecionados={participantes} aoMudar={setParticipantes} />

        <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
          Você e as pessoas incluídas recebem um lembrete na véspera e no dia, por e-mail e aqui no sistema. Lembretes cujo horário já passou não são enviados.
        </p>

        {erroGeral && (
          <p role="alert" className="rounded-lg border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
            {erroGeral}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variante="ghost" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="submit" disabled={salvando} aria-busy={salvando}>
            {salvando ? "Salvando…" : existente ? "Salvar alterações" : "Criar compromisso"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
