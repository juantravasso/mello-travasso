import type { NovaOpcaoPersonalizadaInput, OpcaoPersonalizada, TipoConta } from "@/types";
import { agoraISO, gerarId, lerBanco, salvarBanco } from "./localDb";
import type { CatalogoRepositorio } from "./repositorios";

export class CatalogoRepositorioLocal implements CatalogoRepositorio {
  async listarCategorias(tipo: TipoConta): Promise<OpcaoPersonalizada[]> {
    const banco = lerBanco();
    return tipo === "pagar" ? banco.catalogos.categoriasPagar : banco.catalogos.categoriasReceber;
  }

  async criarCategoria(tipo: TipoConta, input: NovaOpcaoPersonalizadaInput): Promise<OpcaoPersonalizada> {
    const banco = lerBanco();
    const nova: OpcaoPersonalizada = { ...input, id: gerarId("cat"), criadoEm: agoraISO() };
    if (tipo === "pagar") banco.catalogos.categoriasPagar.push(nova);
    else banco.catalogos.categoriasReceber.push(nova);
    salvarBanco(banco);
    return nova;
  }

  async listarFormasPagamento(): Promise<OpcaoPersonalizada[]> {
    return lerBanco().catalogos.formasPagamento;
  }

  async criarFormaPagamento(input: NovaOpcaoPersonalizadaInput): Promise<OpcaoPersonalizada> {
    const banco = lerBanco();
    const nova: OpcaoPersonalizada = { ...input, id: gerarId("fp"), criadoEm: agoraISO() };
    banco.catalogos.formasPagamento.push(nova);
    salvarBanco(banco);
    return nova;
  }
}
