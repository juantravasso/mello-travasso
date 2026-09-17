"use client";

import { useEffect, useRef, useState } from "react";
import { useCamera } from "@/hooks/useCamera";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

interface CameraCaptureProps {
  onFotoConfirmada: (foto: Blob) => void;
}

export function CameraCapture({ onFotoConfirmada }: CameraCaptureProps) {
  const isDesktop = useIsDesktop();
  const { videoRef, estado, iniciar, parar, capturarFoto } = useCamera();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fotoBlob, setFotoBlob] = useState<Blob | null>(null);
  const inputGaleriaRef = useRef<HTMLInputElement | null>(null);
  const inputFallbackRef = useRef<HTMLInputElement | null>(null);

  // Importante: getUserMedia só é chamado a partir de um toque do usuário
  // (onClick de "Ligar câmera"), nunca automaticamente ao montar a tela —
  // no Safari do iOS, pedir a câmera sem um gesto direto costuma falhar ou
  // nem exibir o prompt de permissão.
  useEffect(() => {
    return () => parar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function definirFoto(blob: Blob) {
    parar();
    setFotoBlob(blob);
    setPreviewUrl(URL.createObjectURL(blob));
  }

  async function aoClicarCapturar() {
    const blob = await capturarFoto();
    if (blob) definirFoto(blob);
  }

  function aoSelecionarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (arquivo) definirFoto(arquivo);
    e.target.value = "";
  }

  function repetir() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFotoBlob(null);
  }

  if (previewUrl && fotoBlob) {
    return (
      <div className="flex flex-col gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt="Pré-visualização do comprovante"
          className="max-h-[60vh] w-full rounded-xl border border-border object-contain bg-black"
        />
        <div className="flex gap-3">
          <Button variante="outline" className="flex-1" onClick={repetir}>
            Repetir
          </Button>
          <Button className="flex-1" onClick={() => onFotoConfirmada(fotoBlob)}>
            Usar esta foto
          </Button>
        </div>
      </div>
    );
  }

  if (isDesktop) {
    return (
      <div className="flex flex-col gap-4">
        <input
          ref={inputGaleriaRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={aoSelecionarArquivo}
        />
        <button
          type="button"
          onClick={() => inputGaleriaRef.current?.click()}
          className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-surface text-muted transition-colors hover:border-primary hover:text-primary"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-10 w-10">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0-4 4m4-4 4 4" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
          </svg>
          <span className="text-sm font-medium">Clique para carregar o arquivo do comprovante</span>
          <span className="text-xs">PNG, JPG ou WEBP</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="relative overflow-hidden p-0">
        {/*
          O <video> fica sempre montado no DOM (só escondido via CSS quando
          inativo) porque useCamera.iniciar() precisa de videoRef.current já
          existente para atribuir o stream ANTES de marcar ativa=true. Se o
          elemento só fosse montado depois de ativa=true, o stream nunca
          seria atribuído a nenhum <video> real — a tela ficava preta mesmo
          com a câmera concedida.
        */}
        <video
          ref={videoRef}
          playsInline
          muted
          className={cn("aspect-[3/4] w-full bg-black object-cover", !estado.ativa && "hidden")}
        />
        {!estado.ativa && (
          <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-3 bg-muted-bg p-6 text-center text-muted">
            {estado.carregando ? (
              <p>Aguardando permissão da câmera…</p>
            ) : estado.erro ? (
              <>
                <p className="text-danger">{estado.erro}</p>
                <Button tamanho="sm" variante="outline" onClick={() => void iniciar()}>
                  Tentar novamente
                </Button>
              </>
            ) : (
              <p>Toque em &quot;Ligar câmera&quot; para fotografar o comprovante.</p>
            )}
          </div>
        )}
      </Card>

      <div className="flex flex-col gap-3">
        {estado.ativa ? (
          <Button tamanho="lg" onClick={aoClicarCapturar}>
            Tirar foto
          </Button>
        ) : !estado.erro ? (
          <Button tamanho="lg" onClick={() => void iniciar()} disabled={estado.carregando}>
            {estado.carregando ? "Ligando câmera…" : "Ligar câmera"}
          </Button>
        ) : null}

        {(!estado.suportada || estado.erro) && (
          <>
            <input
              ref={inputFallbackRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={aoSelecionarArquivo}
            />
            <Button tamanho="lg" variante="outline" onClick={() => inputFallbackRef.current?.click()}>
              Tirar foto (câmera do dispositivo)
            </Button>
          </>
        )}

        <input
          ref={inputGaleriaRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={aoSelecionarArquivo}
        />
        <Button tamanho="lg" variante="secondary" onClick={() => inputGaleriaRef.current?.click()}>
          Selecionar foto da galeria
        </Button>
      </div>
    </div>
  );
}
