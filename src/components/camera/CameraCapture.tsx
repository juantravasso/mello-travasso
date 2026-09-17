"use client";

import { useEffect, useRef, useState } from "react";
import { useCamera } from "@/hooks/useCamera";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

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

  useEffect(() => {
    // No computador não há câmera relevante para fotografar um comprovante
    // físico — pula getUserMedia e mostra só a opção de carregar o arquivo.
    if (!isDesktop) void iniciar();
    return () => parar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop]);

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
    if (!isDesktop) void iniciar();
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
      <Card className="overflow-hidden p-0">
        {estado.ativa ? (
          <video ref={videoRef} playsInline muted className="aspect-[3/4] w-full bg-black object-cover" />
        ) : (
          <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 bg-muted-bg p-6 text-center text-muted">
            <p>{estado.erro ?? "Câmera não iniciada."}</p>
          </div>
        )}
      </Card>

      <div className="flex flex-col gap-3">
        {estado.ativa && (
          <Button tamanho="lg" onClick={aoClicarCapturar}>
            Tirar foto
          </Button>
        )}

        {!estado.suportada || estado.erro ? (
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
        ) : null}

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
