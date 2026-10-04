import { TransbordoService } from './transbordo.service';
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { API_BASE, SessionState, SystemUser } from './session-state';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  state = inject(SessionState);
  private transbordo = inject(TransbordoService);
  user = this.state.user;
  private csrf() {
    return this.http
      .get<{ csrf: string }>(API_BASE + '/auth/csrf')
      .pipe(tap((r) => this.state.csrf.set(r.csrf)));
  }
  check() {
    return this.csrf().pipe(
      switchMap(() => this.http.get<{ user: SystemUser }>(API_BASE + '/auth/me')),
      tap((r) => this.user.set(r.user)),
      map((r) => r.user),
      catchError(() => {
        this.transbordo.parar();
        this.user.set(null);
        return of(null);
      }),
    );
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
