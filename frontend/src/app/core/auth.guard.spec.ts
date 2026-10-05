import { TestBed } from '@angular/core/testing';
import { CanActivateFn, Router, UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom, of } from 'rxjs';
import { adminGuard, paginaInicialGuard, permissaoGuard } from './auth.guard';
import { AuthService } from './services/auth.service';

type Usuario = { role: 'admin' | 'operador'; permissoes?: Record<string, string[]> };

function rodar(guard: CanActivateFn, usuario: Usuario) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { check: () => of(usuario) } },
    ],
  });
  const resultado = TestBed.runInInjectionContext(() => guard({} as never, {} as never));
  return firstValueFrom(resultado as Observable<boolean | UrlTree>);
}
const url = (r: boolean | UrlTree) =>
  r instanceof UrlTree ? TestBed.inject(Router).serializeUrl(r) : r;

const ADMIN: Usuario = { role: 'admin' };
const OPERADOR: Usuario = {
  role: 'operador',
  permissoes: { pedidos: ['ver', 'editar'], clientes: ['ver'] },
};
const GERENTE: Usuario = {
  role: 'operador',
  permissoes: { dashboard: ['ver'], cardapio: ['ver'] },
};

describe('Acesso por perfil', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('página inicial é a primeira tela que o perfil pode ver', async () => {
    expect(url(await rodar(paginaInicialGuard, ADMIN))).toBe('/configuracoes/dashboard');
    expect(url(await rodar(paginaInicialGuard, OPERADOR))).toBe('/pedidos');
    expect(url(await rodar(paginaInicialGuard, GERENTE))).toBe('/configuracoes/dashboard');
    expect(url(await rodar(paginaInicialGuard, { role: 'operador', permissoes: {} }))).toBe(
      '/login',
    );
  });

  it('tela sem permissão leva para a primeira tela liberada', async () => {
    expect(await rodar(permissaoGuard('pedidos'), OPERADOR)).toBe(true);
    expect(url(await rodar(permissaoGuard('cardapio'), OPERADOR))).toBe('/pedidos');
    expect(await rodar(permissaoGuard('cardapio'), GERENTE)).toBe(true);
    expect(url(await rodar(permissaoGuard('pedidos'), GERENTE))).toBe('/configuracoes/dashboard');
    expect(await rodar(permissaoGuard('usuarios'), ADMIN)).toBe(true);
    // Perfil sem nenhuma tela: bloqueia sem redirecionar em círculo.
    expect(await rodar(permissaoGuard('pedidos'), { role: 'operador', permissoes: {} })).toBe(
      false,
    );
  });

  it('Perfis: só o Administrador', async () => {
    expect(await rodar(adminGuard, ADMIN)).toBe(true);
    expect(url(await rodar(adminGuard, OPERADOR))).toBe('/pedidos');
    expect(url(await rodar(adminGuard, GERENTE))).toBe('/configuracoes/dashboard');
  });
});
