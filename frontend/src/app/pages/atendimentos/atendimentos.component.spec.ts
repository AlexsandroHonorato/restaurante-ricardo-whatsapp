import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AtendimentosComponent } from './atendimentos.component';
import { ApiService } from '../../core/services/api.service';

describe('Solicitação de atendimento humano', () => {
  afterEach(() => { TestBed.resetTestingModule(); vi.useRealTimers(); });

  it('detecta o transbordo automaticamente, mantém o card e remove quando o status muda', async () => {
    vi.useFakeTimers();
    let conversas = [{ id: 1, telefone: '5511999999999', status_atual: 'conversa_iniciada' }];
    const consultar = vi.fn(() => of(conversas));
    TestBed.configureTestingModule({
      imports: [AtendimentosComponent],
      providers: [{ provide: ApiService, useValue: {
        getStatusConversas: consultar, getAtendimentos: () => of({ data: [] })
      } }]
    });
    const fixture = TestBed.createComponent(AtendimentosComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.handoff-card')).toBeNull();
    conversas = [{ ...conversas[0], status_atual: 'transbordo_humano' }];
    await vi.advanceTimersByTimeAsync(5000);
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('.handoff-card');
    expect(card.textContent).toContain('Cliente quer falar com um atendente');
    expect(card.querySelector('.handoff-actions button').textContent).toContain('Falar com o cliente');
    await vi.advanceTimersByTimeAsync(5000);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.handoff-card')).toBe(card);
    fixture.componentInstance.transbordo.fechar(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.handoff-card')).toBeNull();
    expect(fixture.componentInstance.transbordo.aguardando()).toBe(1);
    fixture.componentInstance.transbordo.mostrarAlertas();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.handoff-card')).not.toBeNull();
    fixture.componentInstance.filtrar(true);
    expect(fixture.componentInstance.conversasVisiveis()).toHaveLength(1);
    conversas = [{ ...conversas[0], status_atual: 'conversa_iniciada' }];
    await vi.advanceTimersByTimeAsync(5000);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.handoff-card')).toBeNull();
    expect(fixture.componentInstance.conversasVisiveis()).toHaveLength(0);
    fixture.destroy();
    TestBed.resetTestingModule();
    const chamadas = consultar.mock.calls.length;
    await vi.advanceTimersByTimeAsync(10000);
    expect(consultar).toHaveBeenCalledTimes(chamadas);
  });
});


