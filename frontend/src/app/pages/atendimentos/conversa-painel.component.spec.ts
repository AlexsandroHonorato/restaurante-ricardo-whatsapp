import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ConversaPainelComponent } from './conversa-painel.component';
import { API_BASE } from '../../core/services/session-state';

const TEL = '5512999990001';
const URL_MSG = `${API_BASE}/conversas/${TEL}/mensagens`;
const HISTORICO = {
  bot_pausado_ate: null,
  mensagens: [
    {
      id: 1,
      direcao: 'entrada',
      texto: 'Quero falar com alguém',
      status: 'processada',
      enviada_por: null,
      created_at: '2026-10-05T12:00:00Z',
    },
    {
      id: 2,
      direcao: 'saida',
      texto: 'Já chamo a equipe!',
      status: 'enviada',
      enviada_por: null,
      created_at: '2026-10-05T12:00:05Z',
    },
  ],
};

function montar() {
  vi.useFakeTimers();
  TestBed.configureTestingModule({
    imports: [ConversaPainelComponent],
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  const fixture = TestBed.createComponent(ConversaPainelComponent);
  fixture.componentRef.setInput('telefone', TEL);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  http.expectOne(URL_MSG).flush(HISTORICO);
  fixture.detectChanges();
  return { fixture, http, el: fixture.nativeElement as HTMLElement, c: fixture.componentInstance };
}

describe('Conversa no painel', () => {
  afterEach(() => vi.useRealTimers());

  it('mostra o histórico do cliente e do bot e atualiza enquanto aberta', () => {
    const { fixture, http, el } = montar();
    const baloes = el.querySelectorAll('.balao');
    expect(baloes.length).toBe(2);
    expect(baloes[0].classList).toContain('cliente');
    expect(baloes[1].textContent).toContain('Bot');
    vi.advanceTimersByTime(5000);
    http.expectOne(URL_MSG).flush(HISTORICO);
    fixture.destroy();
    vi.advanceTimersByTime(5000);
    http.verify();
  });

  it('rola até a última mensagem quando chega uma nova, sem mexer na rolagem se nada mudou', () => {
    const { fixture, http, el } = montar();
    const lista = el.querySelector('.historico') as HTMLElement;
    Object.defineProperty(lista, 'scrollHeight', { configurable: true, value: 900 });
    lista.scrollTop = 120;
    vi.advanceTimersByTime(5000);
    http.expectOne(URL_MSG).flush(HISTORICO);
    fixture.detectChanges();
    expect(lista.scrollTop).toBe(120);
    vi.advanceTimersByTime(5000);
    http.expectOne(URL_MSG).flush({
      ...HISTORICO,
      mensagens: [...HISTORICO.mensagens, { ...HISTORICO.mensagens[0], id: 3, texto: 'Oi?' }],
    });
    fixture.detectChanges();
    expect(lista.scrollTop).toBe(900);
    fixture.destroy();
  });

  it('envia a resposta do atendente, mostra que o bot pausou e não envia duas vezes', () => {
    const { fixture, http, el, c } = montar();
    c.texto = 'Olá, aqui é a Ana!';
    c.enviar();
    c.enviar();
    const req = http.expectOne({ method: 'POST', url: URL_MSG });
    expect(req.request.body).toEqual({ texto: 'Olá, aqui é a Ana!' });
    req.flush({
      enviado: true,
      bot_pausado_ate: '2026-10-05T14:00:00Z',
      mensagem: {
        id: 3,
        direcao: 'saida',
        texto: 'Olá, aqui é a Ana!',
        status: 'enviada',
        enviada_por: 'Ana',
        created_at: '2026-10-05T12:01:00Z',
      },
    });
    fixture.detectChanges();
    expect(c.texto).toBe('');
    expect(el.textContent).toContain('Bot pausado nesta conversa');
    expect(el.querySelectorAll('.balao').length).toBe(3);
    http.verify();
  });

  it('devolve a conversa ao bot', () => {
    const { fixture, http, el } = montar();
    (el.querySelector('.pausa') as HTMLButtonElement).click();
    const req = http.expectOne({ method: 'POST', url: `${API_BASE}/conversas/${TEL}/pausa` });
    expect(req.request.body).toEqual({ pausar: true });
    req.flush({ bot_pausado_ate: '2026-10-05T14:00:00Z' });
    fixture.detectChanges();
    (el.querySelector('.pausa') as HTMLButtonElement).click();
    const devolver = http.expectOne({ method: 'POST', url: `${API_BASE}/conversas/${TEL}/pausa` });
    expect(devolver.request.body).toEqual({ pausar: false });
    devolver.flush({ bot_pausado_ate: null });
    fixture.detectChanges();
    expect(el.textContent).toContain('Bot respondendo');
    http.verify();
  });

  it('falha no envio mantém o texto para tentar de novo', () => {
    const { fixture, http, el, c } = montar();
    c.texto = 'Oi';
    c.enviar();
    http.expectOne({ method: 'POST', url: URL_MSG }).flush({}, { status: 500, statusText: 'Erro' });
    fixture.detectChanges();
    expect(c.texto).toBe('Oi');
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Não foi possível enviar');
    http.verify();
  });
});
