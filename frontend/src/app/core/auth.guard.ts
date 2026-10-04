import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './services/auth.service';
export const authGuard:CanActivateFn = () => {
  const auth = inject(AuthService), router=inject(Router);
  return auth.check().pipe(map(user => user ? true : router.createUrlTree(['/login'])));
};
export const adminGuard:CanActivateFn = () => {
  const auth=inject(AuthService), router=inject(Router);
  return auth.check().pipe(map(user => user?.role === 'admin' ? true : router.createUrlTree(['/dashboard'])));
};
