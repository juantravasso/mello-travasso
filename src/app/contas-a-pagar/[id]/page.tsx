import { ContaDetalhe } from "@/components/contas/ContaDetalhe";
import { PageHeader } from "@/components/layout/PageHeader";

export default async function ContaAPagarDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-xl animar-entrada">
      <PageHeader titulo="Conta a pagar" />
      <ContaDetalhe contaId={id} />
    </div>
  );
}
