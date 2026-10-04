import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CardapioSemanalComponent } from './cardapio-semanal.component';
import { confirmarSaidaSemSalvar } from '../../core/alteracoes-pendentes.guard';

const API = 'http://localhost:8080/api';
const produto = (id: number, nome: string, dias: string, ativo = true) => ({
  id,
  nome,
  ativo,
  dias_disponiveis: dias,
  variacoes: [],
});
const CARDAPIO = [
  {
    id: 1,
    nome: 'Prato do Dia',
    produtos: [produto(1, 'Feijoada', 'qua,sab'), produto(2, 'Strogonoff', 'segunda')],
  },
  {
    id: 2,
    nome: 'Pratos Diários',
    produtos: [
      produto(3, 'Filé de Frango', 'todos'),
      produto(4, 'Calabresa', 'segunda,terça,quarta,quinta,sexta'),
      produto(5, 'Omelete', 'todos', false),
    ],
  },
];
// Segunda a sábado aberto, domingo fechado.
const HORARIOS = {
  horarios: Array.from({ length: 7 }, (_, i) => ({
    id: i + 1,
    dia_semana: i + 1,
    nome_dia: '',
    ativo: i < 6,
    hora_inicio: i < 6 ? '11:00' : null,
    hora_fim: i < 6 ? '14:30' : null,
  })),
};

function montar(horarios: unknown = HORARIOS) {
  TestBed.configureTestingModule({
    imports: [CardapioSemanalComponent],
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  const fixture = TestBed.createComponent(CardapioSemanalComponent);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  http.expectOne(`${API}/cardapio`).flush(CARDAPIO);
  const reqHorarios = http.expectOne(`${API}/horarios-atendimento`);
  if (horarios) reqHorarios.flush(horarios);
  else reqHorarios.flush({}, { status: 500, statusText: 'Erro' });
  fixture.detectChanges();
  const c = fixture.componentInstance;
  const linha = (nome: string) => c.linhas().find((l) => l.produto.nome === nome)!;
  return { fixture, http, c, linha, el: fixture.nativeElement as HTMLElement };
}

describe('Grade semanal do cardápio', () => {
  it('separa prato do dia, pratos que variam e os servidos em todos os dias de atendimento', () => {
    const { c, http } = montar();
    const s = c.secoes();
    expect(s.pratosDoDia.map((l) => l.produto.nome)).toEqual(['Feijoada', 'Strogonoff']);
    expect(s.variaveis.map((l) => l.produto.nome)).toEqual(['Calabresa']);
    expect(s.fixos.map((l) => l.produto.nome)).toEqual(['Filé de Frango', 'Omelete']);
    expect(c.fixosVisiveis()).toBe(false);
    c.busca.set('file');
    expect(c.fixosVisiveis()).toBe(true);
    http.verify();
  });

  it('bloqueia dia fechado e mantém o valor salvo dele', () => {
    const { c, linha, el, http } = montar();
    const file = linha('Filé de Frango');
    c.alternar(file, 6);
    expect(file.dias).toContain('domingo');
    expect(c.pendentes().length).toBe(0);
    const domingo = el.querySelector<HTMLButtonElement>('[aria-label="Feijoada — Domingo"]')!;
    expect(domingo.disabled).toBe(true);
    http.verify();
  });

  it('sem agenda disponível, nenhum dia é bloqueado', () => {
    const { c, http } = montar(null);
    expect(c.diaFechado(6)).toBe(false);
    http.verify();
  });

  it('conta pratos do dia por dia aberto e avisa quando falta', () => {
    const { c, http } = montar();
    expect(c.pratosDoDiaNoDia(0)).toBe(1);
    expect(c.pratosDoDiaNoDia(1)).toBe(0);
    expect(c.semPratoDoDia(1)).toBe(true);
    expect(c.semPratoDoDia(6)).toBe(false);
    http.verify();
  });

  it('marcado e desmarcado são anunciados e destacados de forma diferente', () => {
    const { el, http } = montar();
    const qua = el.querySelector('[aria-label="Feijoada — Quarta-feira"]')!;
    const seg = el.querySelector('[aria-label="Feijoada — Segunda-feira"]')!;
    expect(qua.getAttribute('aria-pressed')).toBe('true');
    expect(qua.classList).toContain('on');
    expect(seg.getAttribute('aria-pressed')).toBe('false');
    expect(seg.classList).not.toContain('on');
    http.verify();
  });

  it('salva todas as alterações juntas e mantém pendente só o que falhou', () => {
    const { c, linha, http } = montar();
    c.alternar(linha('Feijoada'), 0);
    c.alternar(linha('Calabresa'), 5);
    expect(c.pendentes().length).toBe(2);
    c.salvarTudo();
    c.salvarTudo();
    const feijoada = http.expectOne(`${API}/cardapio/produtos/1`);
    expect(feijoada.request.body).toEqual({ dias_disponiveis: 'segunda,quarta,sabado' });
    feijoada.flush({});
    http.expectOne(`${API}/cardapio/produtos/4`).flush({}, { status: 500, statusText: 'Erro' });
    expect(c.pendentes().map((l) => l.produto.nome)).toEqual(['Calabresa']);
    expect(linha('Calabresa').erro).toBeTruthy();
    expect(linha('Calabresa').dias).toContain('sabado');
    expect(c.mensagem()?.erro).toBe(true);
    expect(c.salvando()).toBe(false);
    http.verify();
  });

  it('não salva prato sem nenhum dia e desfaz tudo', () => {
    const { c, linha, http } = montar();
    const strogonoff = linha('Strogonoff');
    c.alternar(strogonoff, 0);
    c.salvarTudo();
    expect(c.mensagem()?.texto).toContain('Strogonoff');
    c.desfazerTudo();
    expect(strogonoff.dias).toEqual(['segunda']);
    expect(c.pendentes().length).toBe(0);
    http.verify();
  });

  it('pede confirmação para sair só quando há alteração pendente', () => {
    const { c, linha, http } = montar();
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const sair = () =>
      TestBed.runInInjectionContext(() =>
        confirmarSaidaSemSalvar(c, null as never, null as never, null as never),
      );
    expect(sair()).toBe(true);
    expect(confirmar).not.toHaveBeenCalled();
    c.alternar(linha('Feijoada'), 0);
    expect(sair()).toBe(false);
    expect(confirmar).toHaveBeenCalledOnce();
    confirmar.mockRestore();
    http.verify();
  });

  it('mostra o que está disponível hoje conforme o que está salvo', () => {
    const { c, linha, http } = montar();
    c.diaHoje.set(2); // quarta
    c.alternar(linha('Strogonoff'), 2);
    const hoje = c.disponivelHoje();
    expect(hoje.pratosDoDia).toEqual(['Feijoada']);
    expect(hoje.outros).toBe(2); // Filé e Calabresa; Omelete está pausado
    c.diaHoje.set(6);
    expect(c.diaFechado(c.diaHoje())).toBe(true);
    http.verify();
  });
});
