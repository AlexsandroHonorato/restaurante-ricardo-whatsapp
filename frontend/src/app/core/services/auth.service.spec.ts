import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { API_BASE, SessionState } from './session-state';
import { sessionInterceptor } from '../session.interceptor';
import { criteriosSenha } from '../../shared/ui/password-rules';

describe('Login seguro',()=>{
 let http:HttpTestingController;let auth:AuthService;
 beforeEach(()=>{TestBed.configureTestingModule({providers:[provideHttpClient(withInterceptors([sessionInterceptor])),provideHttpClientTesting(),provideRouter([])]});http=TestBed.inject(HttpTestingController);auth=TestBed.inject(AuthService);});
 afterEach(()=>http.verify());
 it('obtém CSRF e envia credenciais com cookie, sem gravar senha na sessão',()=>{
  auth.login('admin@example.com','Senha123!').subscribe();
  const csrf=http.expectOne(API_BASE+'/auth/csrf');expect(csrf.request.withCredentials).toBe(true);csrf.flush({csrf:'token-teste'});
  const login=http.expectOne(API_BASE+'/auth/login');expect(login.request.headers.get('X-CSRF-TOKEN')).toBe('token-teste');expect(login.request.withCredentials).toBe(true);
  login.flush({csrf:'csrf-renovado',user:{id:1,name:'Ana',email:'admin@example.com',role:'admin',active:true}});
  expect(TestBed.inject(SessionState).csrf()).toBe('csrf-renovado');expect(auth.user()?.name).toBe('Ana');expect('password' in auth.user()!).toBe(false);
 });
 it('não mantém usuário após consulta de sessão inválida',()=>{
  auth.check().subscribe(user=>expect(user).toBeNull());
  http.expectOne(API_BASE+'/auth/csrf').flush({csrf:'token'});
  http.expectOne(API_BASE+'/auth/me').flush({}, {status:401,statusText:'Unauthorized'});
  expect(auth.user()).toBeNull();
 });
 it('avalia os cinco critérios da senha',()=>{
  expect(criteriosSenha('abc')).toEqual([false,false,true,false,false]);
  expect(criteriosSenha('Senha123!').every(Boolean)).toBe(true);
  expect(criteriosSenha('SENHA123!').every(Boolean)).toBe(false);
 });
});
