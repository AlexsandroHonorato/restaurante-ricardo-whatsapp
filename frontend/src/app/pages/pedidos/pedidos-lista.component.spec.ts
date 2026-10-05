import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { PedidosComponent } from './pedidos.component';
import { ApiService } from '../../core/services/api.service';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';

registerLocaleData(localePt, 'pt-BR');

const pedido = (id: number, status = 'pendente') => ({
  id,
  codigo_pedido: `PED-${id}`,
  status,
  forma_pagamento: 'pix',
  valor_total: 10,
  created_at: '2026-10-04T12:00:00Z',
  itens: [],
});
const pagina = (n: number, ultima: number, dados = [pedido(n)]) => ({
  data: dados,
  current_page: n,
  last_page: ultima,
  total: ultima * 15,
});

function montar(getPedidos: ReturnType<typeof vi.fn>, updatePedidoStatus = vi.fn()) {
  TestBed.configureTestingModule({
    imports: [PedidosComponent],
    providers: [
      {
        provide: ApiService,
        useValue: { getPedidos, updatePedidoStatus, getKpis: () => of({}) },
      },
    ],
  });
  const f = TestBed.createComponent(PedidosComponent);
  f.detectChanges();
  return { f, c: f.componentInstance, el: f.nativeElement as HTMLElement };
}

describe('Lista de pedidos', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('pagina, volta à primeira página ao filtrar e mostra erro sem apagar a lista', () => {
    const getPedidos = vi.fn((_s?: string, _b?: string, n = 1) => of(pagina(n, 3)));
    const { f, c, el } = montar(getPedidos);
    f.detectChanges();
    expect(el.textContent).toContain('Página 1 de 3');
    (
      [...el.querySelectorAll('.paginacao button')].find((b) =>
        b.textContent?.includes('Próxima'),
      ) as HTMLButtonElement
    ).click();
    f.detectChanges();
    expect(getPedidos).toHaveBeenLastCalledWith('', '', 2);
    expect(el.textContent).toContain('PED-2');
    c.filtrarStatus('em_preparo');
    expect(getPedidos).toHaveBeenLastCalledWith('em_preparo', '', 1);

    getPedidos.mockReturnValue(throwError(() => new Error('offline')));
    c.carregarPedidos();
    f.detectChanges();
    expect(el.querySelector('.lista-erro')?.textContent).toContain('Não foi possível carregar');
    expect(el.textContent).toContain('PED-1');
    getPedidos.mockReturnValue(of(pagina(1, 1)));
    (el.querySelector('.lista-erro button') as HTMLButtonElement).click();
    f.detectChanges();
    expect(el.querySelector('.lista-erro')).toBeNull();
    expect(el.querySelector('.paginacao')).toBeNull();
  });

  it('página que ficou vazia volta para a última existente', () => {
    const getPedidos = vi.fn((_s?: string, _b?: string, n = 1) =>
      of(n > 2 ? { data: [], current_page: n, last_page: 2, total: 20 } : pagina(n, 2)),
    );
    const { c } = montar(getPedidos);
    c.irParaPagina(3);
    expect(getPedidos).toHaveBeenLastCalledWith('', '', 2);
    expect(c.pagina()).toBe(2);
  });

  it('alterar status: trava clique duplo e mostra o motivo da recusa', () => {
    const resposta = new Subject<unknown>();
    const atualizar = vi.fn(() => resposta);
    const { f, c, el } = montar(
      vi.fn(() => of(pagina(1, 1))),
      atualizar,
    );
    const p = c.pedidos()[0];
    c.alterarStatus(p, 'em_preparo');
    c.alterarStatus(p, 'em_preparo');
    expect(atualizar).toHaveBeenCalledTimes(1);
    f.detectChanges();
    expect((el.querySelector('.order-actions .btn-primary') as HTMLButtonElement).disabled).toBe(
      true,
    );
    resposta.error({ error: { message: 'Pedido já foi cancelado.' } });
    f.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'PED-1: Pedido já foi cancelado.',
    );
    expect((el.querySelector('.order-actions .btn-primary') as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
});
