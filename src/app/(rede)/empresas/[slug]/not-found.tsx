import Link from "next/link";
import { Card } from "@/components/ui/Card";

export default function PerfilNaoEncontrado() {
  return (
    <Card className="mx-auto flex max-w-lg flex-col gap-2 text-sm text-muted">
      <h1 className="text-lg font-semibold text-foreground">Perfil não encontrado</h1>
      <p>O endereço pode estar errado, ou o perfil foi despublicado pelo responsável.</p>
      <Link href="/rede" className="w-fit font-medium text-primary underline underline-offset-4">
        Pesquisar profissionais
      </Link>
    </Card>
  );
}
