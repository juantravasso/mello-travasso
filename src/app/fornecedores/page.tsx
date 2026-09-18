import Link from "next/link";
import { FornecedoresLista } from "@/components/fornecedores/FornecedoresLista";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";

export default function FornecedoresPage() {
  return (
    <div className="animar-entrada">
      <PageHeader
        titulo="Fornecedores"
        acao={
          <Link href="/fornecedores/novo">
            <Button tamanho="sm">+ Novo fornecedor</Button>
          </Link>
        }
      />
      <FornecedoresLista />
    </div>
  );
}
