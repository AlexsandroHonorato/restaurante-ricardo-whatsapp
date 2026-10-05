import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
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
    expect(el.querySelectorAll('li').length).toBe(2);

    vi.advanceTimersByTime(60000);
    http.expectOne(`${API_BASE}/sistema/saude`).flush({ status: 'ok', problemas: [] });
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')).toBeNull();
    fixture.destroy();
    vi.advanceTimersByTime(60000);
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
