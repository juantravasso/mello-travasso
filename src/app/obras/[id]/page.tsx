import { ObraDetalhe } from "@/components/obras/ObraDetalhe";
import { PageHeader } from "@/components/layout/PageHeader";

export default async function ObraDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="animar-entrada">
      <PageHeader titulo="Detalhe da obra" />
      <ObraDetalhe obraId={id} />
    </div>
  );
}
