import { useCallback, useEffect, useRef, useState } from "react";

interface EstadoCamera {
  suportada: boolean;
  ativa: boolean;
  erro: string | null;
}

/**
 * Controla o acesso à câmera via getUserMedia. Quando a câmera não está
 * disponível ou a permissão é negada, a tela de captura recorre a um
 * <input type="file" capture="environment"> (ver CameraCapture.tsx) —
 * este hook só expõe se o stream de vídeo está ativo ou não.
 */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Começa sempre como "não suportada" (igual à renderização no servidor,
  // onde `navigator` não existe) para evitar mismatch de hidratação; o
  // suporte real só é verificado no efeito abaixo, que roda só no cliente.
  const [estado, setEstado] = useState<EstadoCamera>({
    suportada: false,
    ativa: false,
    erro: null,
  });

  const iniciar = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setEstado((s) => ({ ...s, suportada: false }));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setEstado({ suportada: true, ativa: true, erro: null });
    } catch {
      setEstado({ suportada: true, ativa: false, erro: "Não foi possível acessar a câmera. Use o botão de upload." });
    }
  }, []);

  const parar = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setEstado((s) => ({ ...s, ativa: false }));
  }, []);

  const capturarFoto = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) {
        resolve(null);
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const contexto = canvas.getContext("2d");
      if (!contexto) {
        resolve(null);
        return;
      }
      contexto.drawImage(video, 0, 0);
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
    });
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return { videoRef, estado, iniciar, parar, capturarFoto };
}
