import type { ModuloChave } from "@/lib/auth/modulos";

// Usuários de uma empresa, gerenciados pelo dono (Configurações).

export type SituacaoUsuarioEmpresa =
  | "ativo"
  /** Foi criado e ainda não trocou a senha temporária. */
  | "aguardando_primeiro_acesso"
  /** A senha temporária venceu antes do primeiro acesso: precisa redefinir. */
  | "senha_temporaria_vencida"
  | "desativado"
  /** Bloqueado pela administração da plataforma. */
  | "bloqueado";

export interface UsuarioEmpresaItem {
  id: string;
  nome: string;
  email: string;
  papel: "dono" | "membro";
  /** Módulos que a pessoa usa: o dono tem todos; o membro, os que foram liberados. */
  modulos: ModuloChave[];
  situacao: SituacaoUsuarioEmpresa;
  criadoEm: string;
  /** Último uso de uma sessão; ausente se nunca entrou. */
  ultimoAcessoEm?: string;
  /** É o próprio usuário que está olhando a lista. */
  voce: boolean;
}

export interface ListaUsuariosEmpresa {
  usuarios: UsuarioEmpresaItem[];
  limite: number;
  /** Módulos que o plano da empresa permite liberar. */
  modulosDisponiveis: ModuloChave[];
}

/** Retorno de criar/redefinir: a senha temporária aparece só aqui, para o dono repassar. */
export interface AcessoTemporario {
  nome: string;
  email: string;
  senhaTemporaria: string;
  validadeDias: number;
  modulos: ModuloChave[];
}
