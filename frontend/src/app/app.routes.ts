import { authGuard, adminGuard, paginaInicialGuard, permissaoGuard } from './core/auth.guard';
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  { path: 'usuarios', redirectTo: 'configuracoes/usuarios' },
  // Página inicial por perfil: a primeira tela que o perfil do usuário pode ver.
  { path: '', pathMatch: 'full', canActivate: [authGuard, paginaInicialGuard], children: [] },
  { path: 'dashboard', redirectTo: 'configuracoes/dashboard' },
  { path: 'cardapio', redirectTo: 'configuracoes/cardapio' },
  {
    path: 'pedidos',
    canActivate: [authGuard, permissaoGuard('pedidos')],
    loadComponent: () =>
      import('./pages/pedidos/pedidos.component').then((m) => m.PedidosComponent),
  },
  {
    path: 'clientes',
    canActivate: [authGuard, permissaoGuard('clientes')],
    loadComponent: () =>
      import('./pages/clientes/clientes.component').then((m) => m.ClientesComponent),
  },
  {
    path: 'atendimentos',
    canActivate: [authGuard, permissaoGuard('atendimentos')],
    loadComponent: () =>
      import('./pages/atendimentos/atendimentos.component').then((m) => m.AtendimentosComponent),
  },
  {
    path: 'configuracoes',
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        canActivate: [permissaoGuard('dashboard')],
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'cardapio',
        canActivate: [permissaoGuard('cardapio')],
        loadComponent: () =>
          import('./pages/cardapio/cardapio.component').then((m) => m.CardapioComponent),
      },
      {
        path: 'empresa',
        canActivate: [permissaoGuard('empresa')],
        loadComponent: () =>
          import('./pages/configuracoes/empresa.component').then((m) => m.EmpresaComponent),
      },
      {
        path: 'horarios',
        canActivate: [permissaoGuard('horarios')],
        loadComponent: () =>
          import('./pages/configuracoes/configuracoes.component').then(
            (m) => m.ConfiguracoesComponent,
          ),
      },
      {
        path: 'usuarios',
        canActivate: [permissaoGuard('usuarios')],
        loadComponent: () =>
          import('./pages/usuarios/usuarios.component').then((m) => m.UsuariosComponent),
      },
      {
        path: 'perfis',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/perfis/perfis.component').then((m) => m.PerfisComponent),
      },
      { path: 'pratos-semana', redirectTo: 'cardapio' },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
