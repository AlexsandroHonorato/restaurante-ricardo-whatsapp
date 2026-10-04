import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_BASE, SessionState } from './services/session-state';

export const sessionInterceptor: HttpInterceptorFn = (req,next) => {
  if (!req.url.startsWith(API_BASE + '/')) return next(req);
  const state = inject(SessionState);
  const router = inject(Router);
  const headers: Record<string,string> = { Accept:'application/json' };
  if (!['GET','HEAD','OPTIONS'].includes(req.method) && state.csrf()) headers['X-CSRF-TOKEN'] = state.csrf();
  return next(req.clone({withCredentials:true,setHeaders:headers})).pipe(catchError((error:HttpErrorResponse) => {
    if ((error.status === 401 || error.status === 419) && !req.url.includes('/auth/')) {
      state.user.set(null);
      void router.navigateByUrl('/login');
    }
    return throwError(() => error);
  }));
};
