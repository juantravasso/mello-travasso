import { FornecedoresLista } from "@/components/fornecedores/FornecedoresLista";
import { PageHeader } from "@/components/layout/PageHeader";

export default function FornecedoresPage() {
  return (
    <div className="animar-entrada">
      <PageHeader titulo="Fornecedores" />
      <FornecedoresLista />
    </div>
  );
}
