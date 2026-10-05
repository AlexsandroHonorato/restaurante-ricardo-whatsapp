import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { PedidosComponent } from './pedidos.component';
import { ApiService } from '../../core/services/api.service';
import { SessionState } from '../../core/services/session-state';
import { ConfirmacaoService, PedidoConfirmacao } from '../../shared/ui/confirmacao.service';

registerLocaleData(localePt, 'pt-BR');

const PEDIDO = {
  id: 7,
  codigo_pedido: 'PED-7',
  status: 'pendente',
  forma_pagamento: 'pix',
  valor_total: 10,
  created_at: '2026-10-04T12:00:00Z',
  itens: [],
};
const lista = (dados: object[]) => ({ data: dados, current_page: 1, last_page: 1, total: 1 });

function montar(usuario: object, excluirPedido = vi.fn(() => of({ ok: true }))) {
  // Modal de decisão: guarda o pedido; cada teste decide se confirma.
  const pedir = vi.fn<(pedido: PedidoConfirmacao, aoConfirmar: () => void) => void>();
  const getPedidos = vi.fn(() => of(lista([PEDIDO])));
  TestBed.configureTestingModule({
    imports: [PedidosComponent],
    providers: [
      { provide: SessionState, useValue: { user: signal(usuario), csrf: signal('') } },
      { provide: ConfirmacaoService, useValue: { pedir } },
      {
        provide: ApiService,
        useValue: { getPedidos, excluirPedido, getKpis: () => of({}) },
      },
    ],
  });
  const f = TestBed.createComponent(PedidosComponent);
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  const icone = () => el.querySelector('.excluir-pedido') as HTMLButtonElement | null;
  return { f, el, icone, pedir, getPedidos, excluirPedido };
}

describe('Exclusão de pedido', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('ícone no card pede confirmação e só exclui depois dela', () => {
    const { f, el, icone, pedir, getPedidos, excluirPedido } = montar({ role: 'admin' });
    expect(icone()?.getAttribute('aria-label')).toBe('Excluir pedido PED-7');
    icone()!.click();
    expect(excluirPedido).not.toHaveBeenCalled();
    expect(pedir.mock.calls[0][0].mensagem).toContain('PED-7');
    expect(pedir.mock.calls[0][0].perigo).toBe(true);

    getPedidos.mockReturnValue(of(lista([])));
    pedir.mock.calls[0][1]();
    f.detectChanges();
    expect(excluirPedido).toHaveBeenCalledWith(7);
    expect(el.textContent).toContain('Pedido PED-7 excluído.');
    expect(icone()).toBeNull();
  });

  it('perfil sem "excluir" em Pedidos não vê o ícone', () => {
    const operador = { role: 'operador', permissoes: { pedidos: ['ver', 'editar'] } };
    expect(montar(operador).icone()).toBeNull();
  });

  it('falha na API mantém o pedido e mostra o motivo', () => {
    const recusa = vi.fn(() => throwError(() => ({ error: { message: 'Sem permissão.' } })));
    const { f, el, icone, pedir } = montar({ role: 'admin' }, recusa);
    icone()!.click();
    pedir.mock.calls[0][1]();
    f.detectChanges();
    expect(el.textContent).toContain('Pedido PED-7: Sem permissão.');
    expect(icone()).not.toBeNull();
    expect(icone()!.disabled).toBe(false);
  });
});
