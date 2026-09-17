import type { FiltrosFuncionario, Funcionario, NovoFuncionarioInput } from "@/types";
import { agoraISO, gerarId, lerBanco, salvarBanco } from "./localDb";
import type { FuncionariosRepositorio } from "./repositorios";

function corresponde(funcionario: Funcionario, filtros?: FiltrosFuncionario): boolean {
  if (!filtros) return true;
  if (filtros.obraId && funcionario.obraId !== filtros.obraId) return false;
  if (filtros.status && funcionario.status !== filtros.status) return false;
  if (filtros.busca) {
    const alvo = `${funcionario.nome} ${funcionario.cargo}`.toLowerCase();
    if (!alvo.includes(filtros.busca.toLowerCase())) return false;
  }
  return true;
}

export class FuncionariosRepositorioLocal implements FuncionariosRepositorio {
  async listar(filtros?: FiltrosFuncionario): Promise<Funcionario[]> {
    return lerBanco()
      .funcionarios.filter((f) => corresponde(f, filtros))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }

  async obterPorId(id: string): Promise<Funcionario | null> {
    return lerBanco().funcionarios.find((f) => f.id === id) ?? null;
  }

  async criar(input: NovoFuncionarioInput): Promise<Funcionario> {
    const banco = lerBanco();
    const agora = agoraISO();
    const novo: Funcionario = {
      ...input,
      id: gerarId("func"),
      status: "ativo",
      criadoEm: agora,
      atualizadoEm: agora,
    };
    banco.funcionarios.push(novo);
    salvarBanco(banco);
    return novo;
  }

  async atualizar(id: string, input: Partial<NovoFuncionarioInput>): Promise<Funcionario> {
    const banco = lerBanco();
    const indice = banco.funcionarios.findIndex((f) => f.id === id);
    if (indice === -1) throw new Error(`Funcionário ${id} não encontrado`);
    const existente = banco.funcionarios[indice];
    if (!existente) throw new Error(`Funcionário ${id} não encontrado`);
    const atualizado: Funcionario = { ...existente, ...input, id, atualizadoEm: agoraISO() };
    banco.funcionarios[indice] = atualizado;
    salvarBanco(banco);
    return atualizado;
  }

  async definirStatus(id: string, status: Funcionario["status"]): Promise<Funcionario> {
    const banco = lerBanco();
    const indice = banco.funcionarios.findIndex((f) => f.id === id);
    if (indice === -1) throw new Error(`Funcionário ${id} não encontrado`);
    const existente = banco.funcionarios[indice];
    if (!existente) throw new Error(`Funcionário ${id} não encontrado`);
    const atualizado: Funcionario = { ...existente, status, atualizadoEm: agoraISO() };
    banco.funcionarios[indice] = atualizado;
    salvarBanco(banco);
    return atualizado;
  }
}
