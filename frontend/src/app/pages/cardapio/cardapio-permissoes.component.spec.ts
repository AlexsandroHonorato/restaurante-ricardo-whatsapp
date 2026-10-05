import { signal } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CardapioComponent } from './cardapio.component';
import { SessionState, SystemUser } from '../../core/services/session-state';

const CARDAPIO = [
  {
    id: 1,
    nome: 'Pratos',
    produtos: [
      {
        id: 7,
        nome: 'Frango',
        ativo: true,
        dias_disponiveis: 'todos',
        variacoes: [{ id: 3, tamanho: 'Grande', preco: '30.00' }],
      },
    ],
  },
];

// O app registra pt-BR no main.ts; o teste precisa registrar para o pipe de moeda.
registerLocaleData(localePt, 'pt-BR');

function montar(role: SystemUser['role']) {
  TestBed.configureTestingModule({
    imports: [CardapioComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: SessionState,
        useValue: {
          user: signal({ id: 1, name: 'Ana', email: 'a@x.com', phone: null, role, active: true }),
          csrf: signal(''),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(CardapioComponent);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);
  http.match((r) => r.url.endsWith('/cardapio')).forEach((r) => r.flush(CARDAPIO));
  http.match((r) => r.url.endsWith('/cardapio/categorias')).forEach((r) => r.flush([]));
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('Cardápio por perfil', () => {
  it('operador pausa prato, mas não cria, edita preço nem exclui', () => {
    const el = montar('operador');
    expect(el.textContent).not.toContain('Novo Prato');
    expect(el.querySelector('[aria-label="Editar Frango"]')).toBeNull();
    expect(el.querySelector('[aria-label="Excluir Frango"]')).toBeNull();
    expect(el.querySelector('.toggle-btn')).not.toBeNull();
  });

  it('administrador vê todas as ações', () => {
    const el = montar('admin');
    expect(el.textContent).toContain('Novo Prato');
    expect(el.querySelector('[aria-label="Editar Frango"]')).not.toBeNull();
    expect(el.querySelector('[aria-label="Excluir Frango"]')).not.toBeNull();
  });
});
