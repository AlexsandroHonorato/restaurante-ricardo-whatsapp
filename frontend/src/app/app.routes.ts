import { authGuard, adminGuard, paginaInicialGuard } from './core/auth.guard';
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  { path: 'usuarios', redirectTo: 'configuracoes/usuarios' },
  // Página inicial por perfil: administrador vai ao Dashboard, operador aos Pedidos.
  { path: '', pathMatch: 'full', canActivate: [authGuard, paginaInicialGuard], children: [] },
  { path: 'dashboard', redirectTo: 'configuracoes/dashboard' },
  { path: 'cardapio', redirectTo: 'configuracoes/cardapio' },
  {
    path: 'pedidos',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/pedidos/pedidos.component').then((m) => m.PedidosComponent),
  },
  {
    path: 'clientes',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/clientes/clientes.component').then((m) => m.ClientesComponent),
  },
  {
    path: 'atendimentos',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/atendimentos/atendimentos.component').then((m) => m.AtendimentosComponent),
  },
  {
    path: 'configuracoes',
    canActivate: [authGuard, adminGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'cardapio',
        loadComponent: () =>
          import('./pages/cardapio/cardapio.component').then((m) => m.CardapioComponent),
      },
      {
        path: 'empresa',
        loadComponent: () =>
          import('./pages/configuracoes/empresa.component').then((m) => m.EmpresaComponent),
      },
      {
        path: 'horarios',
        loadComponent: () =>
          import('./pages/configuracoes/configuracoes.component').then(
            (m) => m.ConfiguracoesComponent,
          ),
      },
      {
        path: 'usuarios',
        loadComponent: () =>
          import('./pages/usuarios/usuarios.component').then((m) => m.UsuariosComponent),
      },
      { path: 'pratos-semana', redirectTo: 'cardapio' },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
