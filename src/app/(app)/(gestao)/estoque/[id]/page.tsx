import { ProdutoDetalhe } from "@/components/estoque/ProdutoDetalhe";
import { PageHeader } from "@/components/layout/PageHeader";

export default async function ProdutoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="animar-entrada">
      <PageHeader titulo="Detalhe do produto" />
      <ProdutoDetalhe produtoId={id} />
    </div>
  );
}
