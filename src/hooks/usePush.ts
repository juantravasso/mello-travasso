"use client";

import { useCallback, useEffect, useState } from "react";
import { obterEstadoPush, removerInscricaoPush, salvarInscricaoPush } from "@/services/data/server/pushActions";
import { mensagemDeErro } from "@/lib/mensagemErroAcao";
import { useAmbienteApp } from "./useAmbienteApp";

export type EstadoPushNoAparelho =
  | "carregando"
  /** O servidor não tem as chaves de push configuradas: o recurso não existe ainda. */
  | "indisponivel"
  /** O navegador não sabe receber push (ou não é um contexto seguro). */
  | "nao-suportado"
  /** iPhone/iPad: o push só funciona com o app instalado na tela de início. */
  | "ios-instalar"
  /** A pessoa bloqueou as notificações nas configurações do navegador. */
  | "bloqueado"
  | "desligado"
  | "ligado";

const CHAVE_PUBLICA = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function chaveParaBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const preenchimento = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const bruto = window.atob((base64Url + preenchimento).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);
  return bytes;
}

function suportaPush(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function registro(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

/** Notificações push neste aparelho: estado, ligar e desligar. A inscrição é por aparelho (cada navegador tem a sua). */
export function usePush() {
  const ambiente = useAmbienteApp();
  const [estado, setEstado] = useState<EstadoPushNoAparelho>("carregando");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (ambiente.plataforma === null) return; // ainda não se sabe em que aparelho a página abriu
    let cancelado = false;
    const definir = (e: EstadoPushNoAparelho) => {
      if (!cancelado) setEstado(e);
    };
    (async () => {
      const servidor = await obterEstadoPush().catch(() => null);
      if (!servidor || !servidor.ok || !servidor.dados.disponivel || !CHAVE_PUBLICA) return definir("indisponivel");
      if (ambiente.plataforma === "ios" && !ambiente.instalado) return definir("ios-instalar");
      if (!suportaPush()) return definir("nao-suportado");
      if (Notification.permission === "denied") return definir("bloqueado");
      if (Notification.permission !== "granted") return definir("desligado");
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (!sub) return definir("desligado");
      // Navegador compartilhado: reafirma que esta inscrição é de quem está logado agora (o servidor reatribui o endpoint).
      const json = sub.toJSON();
      if (json.endpoint && json.keys?.p256dh && json.keys.auth) {
        void salvarInscricaoPush({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }).catch(() => undefined);
      }
      definir("ligado");
    })().catch(() => definir("nao-suportado"));
    return () => {
      cancelado = true;
    };
  }, [ambiente.plataforma, ambiente.instalado]);

  const ligar = useCallback(async () => {
    setErro(null);
    setOcupado(true);
    try {
      // O pedido de permissão precisa vir de um toque da pessoa: esta função é chamada direto pelo botão.
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setEstado(permissao === "denied" ? "bloqueado" : "desligado");
        return;
      }
      const reg = await registro();
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(CHAVE_PUBLICA) }));
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error("O navegador não devolveu os dados da inscrição.");
      const r = await salvarInscricaoPush({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth });
      if (!r.ok) {
        await sub.unsubscribe().catch(() => undefined); // não deixa o aparelho "ligado" só no navegador
        setErro(r.mensagem);
        return;
      }
      setEstado("ligado");
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }, []);

  const desligar = useCallback(async () => {
    setErro(null);
    setOcupado(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        const r = await removerInscricaoPush({ endpoint });
        if (!r.ok) setErro(r.mensagem);
      }
      setEstado("desligado");
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }, []);

  return { estado, erro, ocupado, ligar, desligar };
}
