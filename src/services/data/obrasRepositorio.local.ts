import type { NovaObraInput, Obra } from "@/types";
import { agoraISO, gerarId, lerBanco, salvarBanco } from "./localDb";
import type { ObrasRepositorio } from "./repositorios";

export class ObrasRepositorioLocal implements ObrasRepositorio {
  async listar(): Promise<Obra[]> {
    return lerBanco().obras.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  }

  async obterPorId(id: string): Promise<Obra | null> {
    return lerBanco().obras.find((obra) => obra.id === id) ?? null;
  }

  async criar(input: NovaObraInput): Promise<Obra> {
    const banco = lerBanco();
    const agora = agoraISO();
    const novaObra: Obra = {
      ...input,
      id: gerarId("obra"),
      criadoEm: agora,
      atualizadoEm: agora,
    };
    banco.obras.push(novaObra);
    salvarBanco(banco);
    return novaObra;
  }

  async atualizar(id: string, input: Partial<NovaObraInput>): Promise<Obra> {
    const banco = lerBanco();
    const indice = banco.obras.findIndex((obra) => obra.id === id);
    if (indice === -1) throw new Error(`Obra ${id} não encontrada`);
    const existente = banco.obras[indice];
    if (!existente) throw new Error(`Obra ${id} não encontrada`);
    const atualizada: Obra = { ...existente, ...input, id, atualizadoEm: agoraISO() };
    banco.obras[indice] = atualizada;
    salvarBanco(banco);
    return atualizada;
  }
}
