import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { gerarSlug, normalizarBusca } from "../src/lib/rede/texto";

// Importa os municípios (com coordenadas) de prisma/dados/municipios.csv. Idempotente: pode rodar
// de novo sem duplicar (atualiza pelo código do IBGE).
const UF_POR_CODIGO: Record<string, string> = {
  "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
  "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA",
  "31": "MG", "32": "ES", "33": "RJ", "35": "SP",
  "41": "PR", "42": "SC", "43": "RS",
  "50": "MS", "51": "MT", "52": "GO", "53": "DF",
};

async function main() {
  const linhas = readFileSync(resolve("prisma/dados/municipios.csv"), "utf8").trim().split(/\r?\n/);
  const [cabecalho, ...dados] = linhas;
  if (cabecalho.split(",").slice(0, 6).join(",") !== "codigo_ibge,nome,latitude,longitude,capital,codigo_uf") {
    throw new Error("Cabeçalho inesperado no CSV de municípios.");
  }
  const vistos = new Set<string>();
  const registros = dados.map((linha) => {
    const [codigo, nome, lat, lon, , codigoUf] = linha.split(",");
    const uf = UF_POR_CODIGO[codigoUf];
    const latitude = Number(lat);
    const longitude = Number(lon);
    if (!uf || !Number.isInteger(Number(codigo)) || !nome || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error(`Linha inválida: ${linha}`);
    }
    // O Brasil cabe entre ~-34 e ~5,3 de latitude e -74 e -34 de longitude.
    if (latitude < -34 || latitude > 6 || longitude < -75 || longitude > -28) throw new Error(`Coordenada fora do Brasil: ${linha}`);
    const nomeBusca = normalizarBusca(nome);
    if (vistos.has(`${uf}|${nomeBusca}`)) throw new Error(`Município repetido no estado: ${linha}`);
    vistos.add(`${uf}|${nomeBusca}`);
    // A página local usa o slug do nome: dois municípios com o mesmo slug no estado se confundiriam.
    const chaveSlug = `${uf}|slug|${gerarSlug(nome, 80)}`;
    if (vistos.has(chaveSlug)) throw new Error(`Slug repetido no estado: ${linha}`);
    vistos.add(chaveSlug);
    return { ibgeId: Number(codigo), nome, nomeBusca, uf, latitude, longitude };
  });
  if (registros.length < 5500 || registros.length > 5600) throw new Error(`Quantidade suspeita de municípios: ${registros.length}`);

  const prisma = new PrismaClient();
  try {
    for (let i = 0; i < registros.length; i += 500) {
      const lote = registros.slice(i, i + 500);
      await prisma.$transaction(
        lote.map((r) => prisma.municipio.upsert({ where: { ibgeId: r.ibgeId }, update: r, create: r })),
      );
    }
    console.log(`Municípios importados: ${registros.length} (total no banco: ${await prisma.municipio.count()})`);
  } finally {
    await prisma.$disconnect();
  }
}
main();
