// yarn seed:taxonomia
//
// Cria as categorias e profissões iniciais da rede profissional (as do
// briefing do produto). Idempotente: o que já existe (mesmo slug) é mantido
// como está — nunca renomeia, reativa ou apaga nada que a administração tenha
// editado. Depois disso, tudo é gerenciado em /admin/taxonomia.
import { PrismaClient } from "@prisma/client";
import { gerarSlug } from "../src/lib/rede/texto";

const TAXONOMIA: Record<string, string[]> = {
  "Construção civil": [
    "Pedreiro",
    "Eletricista",
    "Encanador",
    "Pintor",
    "Serralheiro",
    "Marceneiro",
    "Gesseiro",
    "Engenheiro",
    "Arquiteto",
  ],
  Serviços: ["Limpeza", "Segurança", "Jardinagem", "Manutenção"],
  Tecnologia: ["Desenvolvimento", "Suporte técnico", "Infraestrutura", "Redes", "Consultoria"],
};

async function main() {
  const prisma = new PrismaClient();
  const agora = new Date().toISOString();
  let criadas = 0;
  let criadasProfissoes = 0;

  try {
    let ordem = 0;
    for (const [nomeCategoria, profissoes] of Object.entries(TAXONOMIA)) {
      const slugCategoria = gerarSlug(nomeCategoria);
      let categoria = await prisma.categoria.findUnique({ where: { slug: slugCategoria } });
      if (!categoria) {
        categoria = await prisma.categoria.create({
          data: { nome: nomeCategoria, slug: slugCategoria, ordem: ordem, criadoEm: agora, atualizadoEm: agora },
        });
        criadas++;
      }
      ordem++;

      for (const nomeProfissao of profissoes) {
        const slug = gerarSlug(nomeProfissao);
        const existe = await prisma.profissao.findUnique({ where: { slug } });
        if (existe) continue;
        await prisma.profissao.create({
          data: { nome: nomeProfissao, slug, categoriaId: categoria.id, criadoEm: agora, atualizadoEm: agora },
        });
        criadasProfissoes++;
      }
    }
    console.log(`Taxonomia: ${criadas} categorias e ${criadasProfissoes} profissões criadas.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
