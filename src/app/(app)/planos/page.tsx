import { exigirSessao } from "@/lib/auth/dal";
import { obterPlanosPublicos } from "@/services/data/server/planosComerciaisActions";
import { PageHeader } from "@/components/layout/PageHeader";
import { PlanosComparacao } from "@/components/planos/PlanosComparacao";

export default async function PlanosPage() {
  await exigirSessao("/planos");
  const r = await obterPlanosPublicos();
  return (
    <div className="animar-entrada">
      <PageHeader titulo="Planos" />
      <PlanosComparacao planos={r.ok ? r.dados : []} pagamentoDisponivel={!!process.env.MERCADOPAGO_ACCESS_TOKEN} />
    </div>
  );
}
