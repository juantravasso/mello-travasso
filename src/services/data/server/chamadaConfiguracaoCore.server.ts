import "server-only";
import { prisma } from "@/lib/prisma";
import { CHAVE_CONFIG_CHAMADA, deveOferecerChamada, lerConfigChamada, type ConfigChamada } from "@/lib/chamadaConfiguracao";

/** Link da agenda e liga/desliga, como o administrador deixou (padrão: desligado). */
export async function obterConfigChamada(): Promise<ConfigChamada> {
  const linha = await prisma.configuracaoPlataforma.findUnique({ where: { chave: CHAVE_CONFIG_CHAMADA } });
  return lerConfigChamada(linha?.valor);
}

/** O convite desta empresa agora, ou null se não deve aparecer (desligado, já respondido ou empresa antiga). */
export async function ofertaDaEmpresa(empresaId: string, agora: Date = new Date()): Promise<{ url: string } | null> {
  const [config, empresa] = await Promise.all([
    obterConfigChamada(),
    prisma.empresa.findUnique({ where: { id: empresaId }, select: { criadoEm: true, chamadaConfiguracaoEstado: true } }),
  ]);
  if (!empresa) return null;
  const oferecer = deveOferecerChamada({ config, estado: empresa.chamadaConfiguracaoEstado, criadaEm: empresa.criadoEm, agora });
  return oferecer ? { url: config.url } : null;
}
