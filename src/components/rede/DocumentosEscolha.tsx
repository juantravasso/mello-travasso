"use client";

import { MAX_DOCUMENTOS_POR_PEDIDO, problemaDoArquivo, TAMANHO_MAXIMO_DOCUMENTO_MB, TIPOS_DOCUMENTO_ACEITOS } from "@/lib/rede/envioDocumento";

/** Escolha dos documentos (até 3) com o aviso de privacidade. Quem usa decide quando enviar. */
export function DocumentosEscolha({
  arquivos,
  aoMudar,
  limite = MAX_DOCUMENTOS_POR_PEDIDO,
  desabilitado,
}: {
  arquivos: File[];
  aoMudar: (arquivos: File[]) => void;
  limite?: number;
  desabilitado?: boolean;
}) {
  const problemas = arquivos.map(problemaDoArquivo).filter((p): p is string => p !== null);

  function adicionar(lista: FileList | null) {
    if (!lista) return;
    aoMudar([...arquivos, ...Array.from(lista)].slice(0, limite));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">
          Documentos (PDF, JPG, PNG ou WebP, até {TAMANHO_MAXIMO_DOCUMENTO_MB} MB cada, no máximo {limite})
        </p>
        <p className="text-xs text-muted">
          Os arquivos são cifrados, só a administração os abre e eles são apagados quando o pedido for decidido (no máximo em 30 dias, em geral antes).
          Envie só o que for necessário e cubra o que não precisar aparecer: outros CPFs, valores, contas.
        </p>
      </div>

      {arquivos.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {arquivos.map((arquivo, indice) => (
            <li key={`${arquivo.name}-${indice}`} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
              <span className="min-w-0 truncate text-foreground">{arquivo.name}</span>
              <button
                type="button"
                disabled={desabilitado}
                onClick={() => aoMudar(arquivos.filter((_, i) => i !== indice))}
                className="min-h-9 flex-shrink-0 text-xs font-medium text-muted underline underline-offset-2 hover:text-foreground disabled:opacity-60"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}

      {problemas.length > 0 && (
        <p role="alert" className="text-xs text-danger">
          {problemas.join(" ")}
        </p>
      )}

      {arquivos.length < limite && (
        <label className="w-fit">
          <input
            type="file"
            accept={TIPOS_DOCUMENTO_ACEITOS}
            multiple
            disabled={desabilitado}
            className="sr-only peer"
            onChange={(e) => {
              adicionar(e.target.files);
              e.target.value = "";
            }}
          />
          <span className="inline-flex min-h-9 cursor-pointer items-center rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:border-primary peer-focus-visible:border-primary peer-disabled:opacity-60">
            {arquivos.length === 0 ? "Escolher documentos" : "Adicionar outro"}
          </span>
        </label>
      )}
    </div>
  );
}
