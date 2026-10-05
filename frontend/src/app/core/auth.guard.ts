import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './services/auth.service';
import { pode, primeiraRota } from './permissoes';
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService),
    router = inject(Router);
  return auth.check().pipe(map((user) => (user ? true : router.createUrlTree(['/login']))));
};
/** Só o Administrador (perfil fixo): tela de Perfis. Os demais vão para a primeira tela que podem ver. */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService),
    router = inject(Router);
  return auth
    .check()
    .pipe(
      map((user) =>
        user?.role === 'admin' ? true : router.createUrlTree([primeiraRota(user) ?? '/login']),
      ),
    );
};
/** Tela liberada pelo perfil ("ver"); sem permissão, vai para a primeira tela que o perfil pode ver. */
export const permissaoGuard =
  (tela: string): CanActivateFn =>
  () => {
    const auth = inject(AuthService),
      router = inject(Router);
    return auth.check().pipe(
      map((user) => {
        if (pode(user, tela, 'ver')) return true;
        const destino = primeiraRota(user);
        return destino ? router.createUrlTree([destino]) : false;
      }),
    );
  };
/** Página inicial: a primeira tela que o perfil pode ver (Dashboard para quem tem; senão Pedidos, e assim por diante). */
export const paginaInicialGuard: CanActivateFn = () => {
  const auth = inject(AuthService),
    router = inject(Router);
  return auth.check().pipe(map((user) => router.createUrlTree([primeiraRota(user) ?? '/login'])));
};
