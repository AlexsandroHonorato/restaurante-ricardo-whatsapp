import { SystemUser } from './services/session-state';

export type Acao = 'ver' | 'criar' | 'editar' | 'excluir';

/**
 * Telas do painel que entram nos perfis de usuário, na ordem em que viram página inicial.
 * As ações de cada tela vêm da API (App\Support\Permissoes), que também confere tudo no servidor.
 */
export const TELAS = [
  { id: 'dashboard', nome: 'Dashboard Geral', rota: '/configuracoes/dashboard' },
  { id: 'pedidos', nome: 'Pedidos & Cozinha', rota: '/pedidos' },
  { id: 'atendimentos', nome: 'Atendimentos IA', rota: '/atendimentos' },
  { id: 'clientes', nome: 'Clientes & LTV', rota: '/clientes' },
  { id: 'cardapio', nome: 'Cardápio & Preços', rota: '/configuracoes/cardapio' },
  { id: 'empresa', nome: 'Dados da empresa', rota: '/configuracoes/empresa' },
  { id: 'horarios', nome: 'Horário de atendimento', rota: '/configuracoes/horarios' },
  { id: 'usuarios', nome: 'Usuários do sistema', rota: '/configuracoes/usuarios' },
] as const;

/** Administrador (perfil fixo) pode tudo; os demais seguem as permissões do perfil recebidas no login. */
export function pode(user: SystemUser | null | undefined, tela: string, acao: Acao): boolean {
  if (!user) return false;
  return user.role === 'admin' || !!user.permissoes?.[tela]?.includes(acao);
}

/** Primeira tela que o usuário pode ver: página inicial e destino de quem tenta abrir tela sem permissão. */
export function primeiraRota(user: SystemUser | null | undefined): string | null {
  return TELAS.find((tela) => pode(user, tela.id, 'ver'))?.rota ?? null;
}
