import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom, of } from 'rxjs';
import { adminGuard, paginaInicialGuard } from './auth.guard';
import { AuthService } from './services/auth.service';

function rodar(guard: typeof adminGuard, role: 'admin' | 'operador') {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { check: () => of({ role }) } },
    ],
  });
  const resultado = TestBed.runInInjectionContext(() => guard({} as never, {} as never));
  return firstValueFrom(resultado as Observable<boolean | UrlTree>);
}
const url = (r: boolean | UrlTree) =>
  r instanceof UrlTree ? TestBed.inject(Router).serializeUrl(r) : r;

describe('Acesso por perfil', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('página inicial: administrador no Dashboard, operador nos Pedidos', async () => {
    expect(url(await rodar(paginaInicialGuard, 'admin'))).toBe('/configuracoes/dashboard');
    TestBed.resetTestingModule();
    expect(url(await rodar(paginaInicialGuard, 'operador'))).toBe('/pedidos');
  });

  it('Configurações: operador é levado aos Pedidos', async () => {
    expect(url(await rodar(adminGuard, 'operador'))).toBe('/pedidos');
    TestBed.resetTestingModule();
    expect(await rodar(adminGuard, 'admin')).toBe(true);
  });
});
