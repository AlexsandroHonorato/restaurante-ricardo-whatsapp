import { Injectable, signal } from '@angular/core';
export const API_BASE = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  ? window.location.protocol + '//' + window.location.hostname + ':8080/api'
  : window.location.origin + '/api';
export interface SystemUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: 'admin' | 'operador';
  active: boolean;
}
@Injectable({ providedIn: 'root' })
export class SessionState {
  user = signal<SystemUser | null>(null);
  csrf = signal('');
}
