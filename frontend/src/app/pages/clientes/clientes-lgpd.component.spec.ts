import { signal } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ClientesComponent } from './clientes.component';
import { API_BASE, SessionState, SystemUser } from '../../core/services/session-state';
import { ConfirmacaoService, PedidoConfirmacao } from '../../shared/ui/confirmacao.service';

registerLocaleData(localePt, 'pt-BR');
const CLIENTE = {
  id: 9,
  nome: 'Maria Souza',
  telefone: '5512999990001',
  total_pedidos: 2,
  total_gasto: '60.00',
  primeiro_contato_em: '2026-10-01',
  enderecos: [],
};

// Modal de decisão: guarda o pedido; cada teste decide se confirma.
const pedir = vi.fn<(pedido: PedidoConfirmacao, aoConfirmar: () => void) => void>();

function montar(role: SystemUser['role']) {
  pedir.mockReset();
  TestBed.configureTestingModule({
    imports: [ClientesComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ConfirmacaoService, useValue: { pedir } },
      {
        provide: SessionState,
        useValue: {
          user: signal({ id: 1, name: 'Ana', email: 'a@x.com', phone: null, role, active: true }),
          csrf: signal(''),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(ClientesComponent);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  http.expectOne(`${API_BASE}/clientes?page=1`).flush({ data: [CLIENTE] });
  fixture.detectChanges();
  return { fixture, http, el: fixture.nativeElement as HTMLElement };
}

describe('Clientes — exclusão de dados (LGPD)', () => {
  it('administrador apaga os dados após confirmar e a lista é recarregada', () => {
    const { fixture, http, el } = montar('admin');
    (el.querySelector('[aria-label="Apagar dados de Maria Souza"]') as HTMLButtonElement).click();
    expect(pedir.mock.calls[0][0].mensagem).toContain('Maria Souza');
    pedir.mock.calls[0][1]();
    http.expectOne({ method: 'DELETE', url: `${API_BASE}/clientes/9` }).flush({ message: 'ok' });
    http.expectOne(`${API_BASE}/clientes?page=1`).flush({ data: [] });
    fixture.detectChanges();
    expect(el.textContent).toContain('Dados pessoais de Maria Souza removidos.');
    http.verify();
  });

  it('sem confirmação nada é enviado', () => {
    const { http, el } = montar('admin');
    (el.querySelector('[aria-label="Apagar dados de Maria Souza"]') as HTMLButtonElement).click();
    expect(pedir).toHaveBeenCalledTimes(1);
    http.verify();
  });

  it('falha ao carregar mostra erro na lista e "Tentar novamente" recarrega', () => {
    const { fixture, http, el } = montar('operador');
    (el.querySelector('input') as HTMLInputElement).value = 'Ma';
    el.querySelector('input')!.dispatchEvent(new Event('input'));
    http
      .expectOne(`${API_BASE}/clientes?page=1&busca=Ma`)
      .flush({}, { status: 500, statusText: 'Erro' });
    fixture.detectChanges();
    expect(el.querySelector('.lista-erro')?.textContent).toContain('Não foi possível carregar');
    expect(el.textContent).toContain('Maria Souza');
    (el.querySelector('.lista-erro button') as HTMLButtonElement).click();
    http
      .expectOne(`${API_BASE}/clientes?page=1&busca=Ma`)
      .flush({ data: [CLIENTE], current_page: 1, last_page: 2, total: 16 });
    fixture.detectChanges();
    expect(el.querySelector('.lista-erro')).toBeNull();
    expect(el.textContent).toContain('Página 1 de 2');
    http.verify();
  });

  it('operador não vê a opção', () => {
    const { el } = montar('operador');
    expect(el.querySelector('[aria-label="Apagar dados de Maria Souza"]')).toBeNull();
  });
});
