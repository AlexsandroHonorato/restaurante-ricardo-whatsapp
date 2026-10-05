import { Injectable, signal } from '@angular/core';
export const API_BASE = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  ? window.location.protocol + '//' + window.location.hostname + ':8080/api'
  : window.location.origin + '/api';
export interface SystemUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  /** admin = perfil fixo Administrador (acesso total); operador = segue o perfil escolhido. */
  role: 'admin' | 'operador';
  active: boolean;
  perfil_id?: number | null;
  /** Na lista de usuários. */
  perfil?: { id: number; nome: string } | null;
  /** No login: nome do perfil em vigor e telas/ações liberadas. */
  perfil_nome?: string;
  permissoes?: Record<string, string[]>;
}
@Injectable({ providedIn: 'root' })
export class SessionState {
  user = signal<SystemUser | null>(null);
  csrf = signal('');
}
