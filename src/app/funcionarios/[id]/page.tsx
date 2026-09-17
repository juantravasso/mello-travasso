import { FuncionarioDetalhe } from "@/components/funcionarios/FuncionarioDetalhe";
import { PageHeader } from "@/components/layout/PageHeader";

export default async function FuncionarioDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-xl animar-entrada">
      <PageHeader titulo="Funcionário" />
      <FuncionarioDetalhe funcionarioId={id} />
    </div>
  );
}
