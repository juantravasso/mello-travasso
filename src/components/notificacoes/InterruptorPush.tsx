"use client";

import Link from "next/link";
import { usePush } from "@/hooks/usePush";
import { Interruptor } from "./Interruptor";

/**
 * Liga as notificações push neste aparelho (cada aparelho liga a sua). Some quando o servidor ainda não tem as chaves
 * de push, e explica o que fazer quando o aparelho não pode receber (iPhone sem o app instalado, navegador sem suporte,
 * permissão bloqueada).
 */
export function InterruptorPush() {
  const { estado, erro, ocupado, ligar, desligar } = usePush();

  if (estado === "carregando" || estado === "indisponivel") return null;

  const apoio = {
    "nao-suportado": "Este navegador não recebe notificações push. Tente o Chrome, Edge ou Firefox, ou o Safari com o app instalado.",
    "ios-instalar": (
      <>
        No iPhone, instale o Elo na tela de início primeiro.{" "}
        <Link href="/ajuda#instalar" className="text-primary underline underline-offset-2">
          Ver como
        </Link>
        .
      </>
    ),
    bloqueado: "As notificações estão bloqueadas neste navegador. Libere nas configurações do site e volte aqui.",
    desligado: "Avisa neste aparelho na véspera e no dia, mesmo com o Elo fechado.",
    ligado: "Ligado neste aparelho. Em outro aparelho, ligue lá também.",
  }[estado];

  const semSuporte = estado === "nao-suportado" || estado === "ios-instalar" || estado === "bloqueado";

  return (
    <div>
      <Interruptor
        rotulo="Notificações push neste aparelho"
        apoio={apoio}
        ligado={estado === "ligado"}
        desabilitado={ocupado || semSuporte}
        aoAlternar={() => void (estado === "ligado" ? desligar() : ligar())}
      />
      {erro && (
        <p role="alert" className="text-sm text-danger">
          {erro}
        </p>
      )}
    </div>
  );
}
