import { FornecedorDetalhe } from "@/components/fornecedores/FornecedorDetalhe";
import { PageHeader } from "@/components/layout/PageHeader";

export default async function FornecedorDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-xl animar-entrada">
      <PageHeader titulo="Fornecedor" />
      <FornecedorDetalhe fornecedorId={id} />
    </div>
  );
}
