import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'pedidos',
    loadComponent: () => import('./pages/pedidos/pedidos.component').then(m => m.PedidosComponent)
  },
  {
    path: 'clientes',
    loadComponent: () => import('./pages/clientes/clientes.component').then(m => m.ClientesComponent)
  },
  {
    path: 'cardapio',
    loadComponent: () => import('./pages/cardapio/cardapio.component').then(m => m.CardapioComponent)
  },
  {
    path: 'atendimentos',
    loadComponent: () => import('./pages/atendimentos/atendimentos.component').then(m => m.AtendimentosComponent)
  },
  {
    path: 'configuracoes',
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
