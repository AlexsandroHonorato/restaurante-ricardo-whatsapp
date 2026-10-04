import { authGuard, adminGuard } from './core/auth.guard';
import { Routes } from '@angular/router';

export const routes: Routes = [
  {path:'login',loadComponent:() => import('./pages/login/login.component').then(m => m.LoginComponent)},
  {path:'usuarios',canActivate:[authGuard,adminGuard],loadComponent:() => import('./pages/usuarios/usuarios.component').then(m => m.UsuariosComponent)},
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'pedidos',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/pedidos/pedidos.component').then(m => m.PedidosComponent)
  },
  {
    path: 'clientes',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/clientes/clientes.component').then(m => m.ClientesComponent)
  },
  {
    path: 'cardapio',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/cardapio/cardapio.component').then(m => m.CardapioComponent)
  },
  {
    path: 'atendimentos',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/atendimentos/atendimentos.component').then(m => m.AtendimentosComponent)
  },
  {
    path: 'configuracoes',
    canActivate: [authGuard],
    children: [
      {path: '', redirectTo: 'horarios', pathMatch: 'full'},
      {path: 'horarios', loadComponent: () => import('./pages/configuracoes/configuracoes.component').then(m => m.ConfiguracoesComponent)},
      {path: 'pratos-semana', loadComponent: () => import('./pages/configuracoes/cardapio-semanal.component').then(m => m.CardapioSemanalComponent)}
    ]
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
