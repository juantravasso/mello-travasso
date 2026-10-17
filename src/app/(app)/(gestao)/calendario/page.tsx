import type { Metadata } from "next";
import { exigirSessao } from "@/lib/auth/dal";
import { CalendarioView } from "@/components/calendario/CalendarioView";
import { hojeDaEmpresa } from "@/services/data/server/calendarioCore.server";

export const metadata: Metadata = { title: "Calendário" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CalendarioPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sessao = await exigirSessao("/calendario");
  const hoje = await hojeDaEmpresa(sessao);
  const { evento } = await searchParams;
  const bruto = Array.isArray(evento) ? evento[0] : evento;
  // Link de lembrete: só um UUID segue adiante; a permissão de ver o compromisso é conferida no servidor.
  return <CalendarioView hojeInicial={hoje} eventoInicial={bruto && UUID.test(bruto) ? bruto : undefined} />;
}
