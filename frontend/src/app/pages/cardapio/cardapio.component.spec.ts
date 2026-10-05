import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { CardapioComponent } from './cardapio.component';

registerLocaleData(localePt, 'pt-BR');

const produto = (id: number, nome: string, dias: string, ativo = true) => ({
  id,
  categoria_id: 1,
  nome,
  ativo,
  dias_disponiveis: dias,
  variacoes: [{ id: id * 10, tamanho: 'Grande', preco: '30.00' }],
});
const CARDAPIO = [
  {
    id: 1,
    nome: 'Pratos',
    produtos: [
      produto(7, 'Frango', 'todos'),
      produto(8, 'Feijoada', 'quarta,sabado'),
      produto(9, 'Omelete', 'todos', false),
    ],
  },
];
const HORARIOS = {
  fuso: 'America/Sao_Paulo',
  horarios: Array.from({ length: 7 }, (_, i) => ({ id: i + 1, dia_semana: i + 1, ativo: i < 6 })),
};

function montar(cardapio: object | 'erro' = CARDAPIO) {
  TestBed.configureTestingModule({
    imports: [CardapioComponent],
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  const fixture = TestBed.createComponent(CardapioComponent);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);
  const lista = http.expectOne((r) => r.url.endsWith('/cardapio'));
  if (cardapio === 'erro') lista.flush({}, { status: 500, statusText: 'Erro' });
  else lista.flush(cardapio);
  http.expectOne((r) => r.url.endsWith('/cardapio/categorias')).flush([]);
  http.expectOne((r) => r.url.endsWith('/horarios-atendimento')).flush(HORARIOS);
  fixture.detectChanges();
  return { fixture, http, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}
const chip = (el: HTMLElement, nome: string) =>
  el.querySelector(`[aria-label="${nome}"]`) as HTMLButtonElement;

describe('Cardápio & Preços (Configurações)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-05T15:00:00Z')); // segunda-feira em São Paulo
  });
  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('mostra o que o bot oferece hoje, ações do administrador e dia fechado', () => {
    const { el } = montar();
    expect(el.querySelector('.painel-hoje')?.textContent).toContain('Hoje · Segunda-feira');
    expect(el.querySelector('.painel-hoje')?.textContent).toContain('1 itens'); // Feijoada fora, Omelete pausado
    expect(el.textContent).toContain('Novo Prato');
    expect(el.querySelector('[aria-label="Editar Frango"]')).not.toBeNull();
    expect(el.querySelector('[aria-label="Excluir Frango"]')).not.toBeNull();
    expect(chip(el, 'Frango — Domingo').classList).toContain('fechado');
    expect(chip(el, 'Feijoada — Quarta-feira').getAttribute('aria-pressed')).toBe('true');
    expect(chip(el, 'Feijoada — Segunda-feira').getAttribute('aria-pressed')).toBe('false');
  });

  it('filtra por dia, situação e nome', () => {
    const { fixture, c, el } = montar();
    c.diaFiltro.set('segunda');
    fixture.detectChanges();
    expect(el.textContent).not.toContain('Feijoada');
    expect(el.textContent).toContain('2 itens');
    c.situacaoFiltro.set('pausados');
    fixture.detectChanges();
    expect(el.textContent).toContain('Omelete');
    expect(el.textContent).not.toContain('Frango');
    c.limparFiltros();
    c.busca.set('feij');
    fixture.detectChanges();
    expect(el.querySelectorAll('.product-row').length).toBe(1);
  });

  it('clicar no dia salva na hora; se a API recusar, volta e avisa', () => {
    const { fixture, http, el } = montar();
    chip(el, 'Feijoada — Segunda-feira').click();
    fixture.detectChanges();
    const req = http.expectOne((r) => r.method === 'PUT' && r.url.endsWith('/cardapio/produtos/8'));
    expect(req.request.body).toEqual({ dias_disponiveis: 'segunda,quarta,sabado' });
    expect(chip(el, 'Feijoada — Segunda-feira').getAttribute('aria-pressed')).toBe('true');
    expect(chip(el, 'Feijoada — Segunda-feira').disabled).toBe(true);
    req.flush({}, { status: 500, statusText: 'Erro' });
    fixture.detectChanges();
    expect(chip(el, 'Feijoada — Segunda-feira').getAttribute('aria-pressed')).toBe('false');
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'Feijoada: não foi possível salvar os dias',
    );
    http.verify();
  });

  it('não deixa tirar o último dia', () => {
    const { fixture, http, c, el } = montar([
      { id: 1, nome: 'Pratos', produtos: [produto(5, 'Bife', 'quarta')] },
    ]);
    chip(el, 'Bife — Quarta-feira').click();
    fixture.detectChanges();
    http.verify();
    expect(c.erroAcao()).toContain('deixe pelo menos um dia');
  });

  it('formulário: atalhos de dias, resumo, aviso de dia fechado e dias enviados ao salvar', () => {
    const { fixture, http, c, el } = montar();
    (el.querySelector('[aria-label="Editar Feijoada"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const form = () => el.querySelector('.dias-form') as HTMLElement;
    const atalho = (rotulo: string) =>
      [...form().querySelectorAll('.atalho')].find((b) =>
        b.textContent?.includes(rotulo),
      ) as HTMLButtonElement;
    expect(form().querySelector('.dias-resumo')?.textContent).toContain(
      'Oferecido: Quarta-feira, Sábado',
    );
    expect(atalho('Dias de atendimento')).toBeTruthy(); // domingo fechado na agenda
    expect(form().querySelector('.dias-aviso')).toBeNull();

    atalho('Fim de semana').click();
    fixture.detectChanges();
    expect(atalho('Fim de semana').getAttribute('aria-pressed')).toBe('true');
    expect(form().querySelector('.dias-aviso')?.textContent).toContain(
      'Domingo: o estabelecimento não abre',
    );

    atalho('Todos os dias').click();
    fixture.detectChanges();
    expect(form().querySelector('.dias-aviso')).toBeNull(); // "todos" = sempre que abrir

    for (const b of form().querySelectorAll<HTMLButtonElement>('.dia-opcao')) b.click();
    fixture.detectChanges();
    expect(form().querySelector('.dias-resumo')?.textContent).toContain(
      'Selecione pelo menos um dia',
    );
    expect(c.formValido()).toBe(false);

    atalho('Segunda a sexta').click();
    c.salvarProduto();
    const req = http.expectOne((r) => r.method === 'PUT' && r.url.endsWith('/cardapio/produtos/8'));
    expect(req.request.body.dias_disponiveis).toBe('segunda,terca,quarta,quinta,sexta');
  });

  it('falha ao carregar mostra aviso com "Tentar novamente"', () => {
    const { fixture, http, el } = montar('erro');
    expect(el.querySelector('.lista-erro')?.textContent).toContain(
      'Não foi possível carregar o cardápio',
    );
    (el.querySelector('.lista-erro button') as HTMLButtonElement).click();
    http.expectOne((r) => r.url.endsWith('/cardapio')).flush(CARDAPIO);
    fixture.detectChanges();
    expect(el.querySelector('.lista-erro')).toBeNull();
    expect(el.textContent).toContain('Frango');
  });
});
