import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { TransbordosModalComponent } from './transbordos-modal.component';
import { TransbordoService } from '../../core/services/transbordo.service';
import { ApiService } from '../../core/services/api.service';

describe('Modal de transbordos', () => {
  function preparar() {
    const fila = signal([{ id: 1, telefone: '5511999999999' }]);
    const resposta = new Subject<{ok:boolean}>();
    const enviar = vi.fn(() => resposta);
    const assumir = vi.fn((id: number) => fila.update(lista => lista.filter(s => s.id !== id)));
    TestBed.configureTestingModule({
      imports: [TransbordosModalComponent],
      providers: [provideRouter([]),
        { provide: TransbordoService, useValue: { fila, aguardando: () => fila().length, assumir } },
        { provide: ApiService, useValue: { iniciarContatoTransbordo: enviar } }]
    });
    const f = TestBed.createComponent(TransbordosModalComponent); f.detectChanges();
    const dialog = f.nativeElement.querySelector('dialog') as HTMLDialogElement;
    dialog.showModal = vi.fn(() => dialog.setAttribute('open',''));
    dialog.close = vi.fn(() => dialog.removeAttribute('open'));
    return { fila, f, c: f.componentInstance, dialog, enviar, resposta, assumir };
  }
  it('abre dialog, fecha sem alterar fila e informa ausência de pendências', () => {
    const {fila,f,c,dialog,assumir} = preparar();
    c.abrir(); expect(dialog.open).toBe(true);
    expect(dialog.getAttribute('aria-labelledby')).toBe('transbordos-titulo');
    c.fechar(); expect(dialog.open).toBe(false); expect(assumir).not.toHaveBeenCalled();
    fila.set([]); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Nenhum transbordo pendente');
  });
  it('envia uma vez, mantém pendência até confirmar e atualiza lista após sucesso', () => {
    const {f,c,enviar,resposta,assumir} = preparar();
    c.falar(1); c.falar(1); expect(enviar).toHaveBeenCalledTimes(1);
    expect(assumir).not.toHaveBeenCalled();
    resposta.next({ok:true}); f.detectChanges();
    expect(assumir).toHaveBeenCalledWith(1);
    expect(f.nativeElement.querySelector('.pending-item')).toBeNull();
    expect(f.nativeElement.querySelector('.success a').getAttribute('href')).toBe('https://wa.me/5511999999999');
  });
  it('mantém cliente pendente e libera botão se envio falhar', () => {
    const {f,c,resposta,assumir} = preparar();
    c.falar(1); resposta.error(new Error('offline')); f.detectChanges();
    expect(assumir).not.toHaveBeenCalled();
    expect(c.enviando().size).toBe(0);
    expect(f.nativeElement.querySelector('.send-error').textContent).toContain('Tente novamente');
  });
});

