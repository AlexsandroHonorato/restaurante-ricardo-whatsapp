import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AvisosSistemaComponent } from './avisos-sistema.component';
import { API_BASE } from '../../core/services/session-state';

describe('Avisos do sistema', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [AvisosSistemaComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });
  afterEach(() => vi.useRealTimers());

  it('mostra cada problema em destaque e some quando o sistema volta ao normal', () => {
    const fixture = TestBed.createComponent(AvisosSistemaComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(`${API_BASE}/sistema/saude`).flush({
      status: 'atencao',
      problemas: [
        { codigo: 'bot_fora_do_ar', mensagem: 'O bot do WhatsApp não está respondendo.' },
        { codigo: 'fila_atrasada', mensagem: '2 mensagem(ns) aguardando reenvio.' },
      ],
    });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'O bot do WhatsApp não está respondendo.',
    );
    expect(el.querySelectorAll('.avisos li').length).toBe(2);

    vi.advanceTimersByTime(60000);
    http.expectOne(`${API_BASE}/sistema/saude`).flush({ status: 'ok', problemas: [] });
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')).toBeNull();
    fixture.destroy();
    vi.advanceTimersByTime(60000);
    http.verify();
  });

  it('ícone do aviso lista as mensagens e abre a conversa do cliente', () => {
    const fixture = TestBed.createComponent(AvisosSistemaComponent);
    const http = TestBed.inject(HttpTestingController);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    const dialog = el.querySelector('dialog') as HTMLDialogElement;
    // jsdom não implementa showModal/close.
    dialog.showModal = vi.fn(() => dialog.setAttribute('open', ''));
    dialog.close = vi.fn(() => dialog.removeAttribute('open'));
    http.expectOne(`${API_BASE}/sistema/saude`).flush({
      problemas: [
        { codigo: 'bot_fora_do_ar', mensagem: 'O bot do WhatsApp não está respondendo.' },
        {
          codigo: 'envios_falharam',
          mensagem: '2 mensagem(ns) não puderam ser enviadas.',
          detalhes: true,
        },
      ],
    });
    fixture.detectChanges();
    // Só o aviso que tem mensagens ganha o ícone.
    expect(el.querySelectorAll('.ver').length).toBe(1);
    (el.querySelector('.ver') as HTMLButtonElement).click();
    http.expectOne(`${API_BASE}/sistema/saude/envios_falharam`).flush([
      {
        id: 9,
        direcao: 'saida',
        telefone: '5511988887777',
        texto: 'Olá, Alex!',
        status: 'falhou',
        erro: 'WhatsApp HTTP 500',
        created_at: '2026-10-05T13:04:08Z',
      },
      {
        id: 8,
        direcao: 'saida',
        telefone: '5511977776666',
        texto: 'Seu pedido saiu',
        status: 'falhou',
        erro: null,
        created_at: '2026-10-05T12:00:00Z',
      },
    ]);
    fixture.detectChanges();
    expect(dialog.open).toBe(true);
    const linhas = dialog.querySelectorAll('.mensagens li');
    expect(linhas.length).toBe(2);
    expect(linhas[0].textContent).toContain('Para 5511988887777');
    expect(linhas[0].textContent).toContain('Olá, Alex!');
    expect(linhas[0].textContent).toContain('WhatsApp HTTP 500');
    (linhas[1].querySelector('button') as HTMLButtonElement).click();
    expect(navegar).toHaveBeenCalledWith(['/atendimentos'], {
      queryParams: { conversa: '5511977776666' },
    });
    expect(dialog.open).toBe(false);
    fixture.destroy();
    http.verify();
  });

  it('falha ao consultar não mostra aviso falso', () => {
    const fixture = TestBed.createComponent(AvisosSistemaComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(`${API_BASE}/sistema/saude`).flush({}, { status: 500, statusText: 'Erro' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).toBeNull();
    fixture.destroy();
    http.verify();
  });
});
