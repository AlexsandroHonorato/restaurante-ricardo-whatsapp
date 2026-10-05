import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { AtendimentosComponent } from './atendimentos.component';
import { ApiService } from '../../core/services/api.service';

describe('Solicitação de atendimento humano', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('detecta o transbordo automaticamente, mantém o card e remove quando o status muda', async () => {
    vi.useFakeTimers();
    let conversas = [{ id: 1, telefone: '5511999999999', status_atual: 'conversa_iniciada' }];
    const consultar = vi.fn(() => of(conversas));
    TestBed.configureTestingModule({
      imports: [AtendimentosComponent],
      providers: [
        {
          provide: ApiService,
          useValue: {
            getStatusConversas: consultar,
            getAtendimentos: () => of({ data: [] }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(AtendimentosComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.handoff-card')).toBeNull();
    conversas = [{ ...conversas[0], status_atual: 'transbordo_humano' }];
    await vi.advanceTimersByTimeAsync(5000);
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('.handoff-card');
    expect(card.textContent).toContain('Cliente quer falar com um atendente');
    expect(card.querySelector('.handoff-actions button').textContent).toContain(
      'Falar com o cliente',
    );
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

  it('abre a conversa no painel pelo card e fecha pelo botão', () => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [AtendimentosComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ApiService,
          useValue: {
            getStatusConversas: () =>
              of([{ id: 1, telefone: '5511999999999', status_atual: 'conversa_iniciada' }]),
            getAtendimentos: () => of({ data: [] }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(AtendimentosComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('.chat-footer button') as HTMLButtonElement).click();
    fixture.detectChanges();
    const modal = el.querySelector('[role="dialog"]');
    expect(modal?.textContent).toContain('Conversa com 5511999999999');
    expect(modal?.querySelector('app-conversa-painel')).not.toBeNull();
    (el.querySelector('[aria-label="Fechar conversa"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    fixture.destroy();
  });

  it('exclui o card só depois de confirmar no modal de decisão', () => {
    vi.useFakeTimers();
    const resposta = new Subject<{ ok: boolean }>();
    const excluir = vi.fn(() => resposta);
    TestBed.configureTestingModule({
      imports: [AtendimentosComponent],
      providers: [
        {
          provide: ApiService,
          useValue: {
            getStatusConversas: () =>
              of([{ id: 1, telefone: '5511999999999', status_atual: 'transbordo_humano' }]),
            getAtendimentos: () => of({ data: [] }),
            excluirConversa: excluir,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(AtendimentosComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const clicar = (seletor: string) => {
      (el.querySelector(seletor) as HTMLButtonElement).click();
      fixture.detectChanges();
    };
    clicar('.excluir-conversa');
    const modal = el.querySelector('[role="alertdialog"]');
    expect(modal?.textContent).toContain('5511999999999');
    expect(modal?.querySelector('.excluir-aviso')?.textContent).toContain('atendimento humano');
    clicar('.excluir-acoes .btn-secondary');
    expect(el.querySelector('[role="alertdialog"]')).toBeNull();
    expect(excluir).not.toHaveBeenCalled();
    clicar('.excluir-conversa');
    clicar('.excluir-confirmar');
    clicar('.excluir-confirmar');
    expect(excluir).toHaveBeenCalledTimes(1);
    expect(excluir).toHaveBeenCalledWith(1);
    resposta.next({ ok: true });
    fixture.detectChanges();
    expect(el.querySelector('[role="alertdialog"]')).toBeNull();
    expect(el.querySelector('.chat-card')).toBeNull();
    fixture.destroy();
  });
});
