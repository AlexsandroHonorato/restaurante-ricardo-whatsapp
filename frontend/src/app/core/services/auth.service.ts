import { TransbordoService } from './transbordo.service';
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, finalize, map, of, shareReplay, switchMap, tap } from 'rxjs';
import { API_BASE, SessionState, SystemUser } from './session-state';
import { Acao, pode } from '../permissoes';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  state = inject(SessionState);
  private transbordo = inject(TransbordoService);
  user = this.state.user;
  /** Permissão do usuário logado: `auth.pode('cardapio', 'editar')`. A API confere de novo em cada ação. */
  pode(tela: string, acao: Acao): boolean {
    return pode(this.user(), tela, acao);
  }
  private csrf() {
    return this.http
      .get<{ csrf: string }>(API_BASE + '/auth/csrf')
      .pipe(tap((r) => this.state.csrf.set(r.csrf)));
  }
  private verificando?: Observable<SystemUser | null>;
  /**
   * Sessão para as guardas de rota. Com usuário já conhecido (login feito ou sessão já conferida) responde
   * na hora, sem ir à API; sessão expirada é percebida pelo interceptor no primeiro 401. Só a primeira abertura
   * consulta a API, e consultas simultâneas compartilham a mesma ida.
   */
  check(): Observable<SystemUser | null> {
    const atual = this.user();
    if (atual) return of(atual);
    this.verificando ??= this.csrf().pipe(
      switchMap(() => this.http.get<{ user: SystemUser }>(API_BASE + '/auth/me')),
      tap((r) => this.user.set(r.user)),
      map((r) => r.user),
      catchError(() => {
        this.transbordo.parar();
        this.user.set(null);
        return of(null);
      }),
      finalize(() => (this.verificando = undefined)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.verificando;
  }
  login(email: string, password: string) {
    return this.csrf().pipe(
      switchMap(() =>
        this.http.post<{ user: SystemUser; csrf: string }>(API_BASE + '/auth/login', {
          email,
          password,
        }),
      ),
      tap((r) => {
        this.user.set(r.user);
        if (r.csrf) this.state.csrf.set(r.csrf);
      }),
    );
  }
  logout() {
    return this.csrf().pipe(
      switchMap(() => this.http.post(API_BASE + '/auth/logout', {})),
      tap(() => {
        this.transbordo.parar();
        this.user.set(null);
        this.state.csrf.set('');
      }),
    );
  }
}
