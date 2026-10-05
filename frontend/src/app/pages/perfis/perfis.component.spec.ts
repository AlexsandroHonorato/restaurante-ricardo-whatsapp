import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PerfisComponent } from './perfis.component';
import { API_BASE } from '../../core/services/session-state';
import { ConfirmacaoService } from '../../shared/ui/confirmacao.service';

const TELAS = {
  dashboard: ['ver'],
  pedidos: ['ver', 'editar'],
  cardapio: ['ver', 'criar', 'editar', 'excluir'],
};
const PERFIS = [
  {
    id: 1,
    nome: 'Operador',
    padrao: true,
    usuarios_count: 2,
    permissoes: { pedidos: ['ver', 'editar'] },
  },
  { id: 5, nome: 'Cozinha', padrao: false, usuarios_count: 0, permissoes: { pedidos: ['ver'] } },
];

function montar() {
  TestBed.configureTestingModule({
    imports: [PerfisComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      // Modal de decisão confirma na hora.
      {
        provide: ConfirmacaoService,
        useValue: { pedir: (_: unknown, aoConfirmar: () => void) => aoConfirmar() },
      },
    ],
  });
  const fixture = TestBed.createComponent(PerfisComponent);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  http.expectOne(`${API_BASE}/perfis`).flush({ perfis: PERFIS, telas: TELAS });
  fixture.detectChanges();
  return { fixture, http, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}
// Busca pelo atributo (rótulos têm "&", que o seletor CSS do jsdom não resolve).
const caixa = (el: HTMLElement, rotulo: string) =>
  ([...el.querySelectorAll('input[type="checkbox"]')].find(
    (campo) => campo.getAttribute('aria-label') === rotulo,
  ) ?? null) as HTMLInputElement;

describe('Perfis de usuário', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('lista o Administrador fixo e os perfis; padrão ou em uso não pode ser excluído', () => {
    const { el } = montar();
    const texto = el.querySelector('.lista')?.textContent ?? '';
    expect(texto).toContain('Administrador');
    expect(texto).toContain('Acesso total');
    expect(texto).toContain('2 usuários');
    expect(
      (el.querySelector('[aria-label="Excluir Operador"]') as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((el.querySelector('[aria-label="Excluir Cozinha"]') as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('grade: só ações que existem na tela; criar/editar/excluir marcam ver; desmarcar ver limpa a tela', () => {
    const { fixture, c, el } = montar();
    (el.querySelector('.novo') as HTMLButtonElement).click();
    fixture.detectChanges();
    // Dashboard só tem "ver".
    expect(caixa(el, 'Ver Dashboard Geral')).not.toBeNull();
    expect(caixa(el, 'Editar Dashboard Geral')).toBeNull();

    caixa(el, 'Editar Cardápio & Preços').click();
    fixture.detectChanges();
    expect(c.marcadas()['cardapio']).toEqual(['ver', 'editar']);
    expect(caixa(el, 'Ver Cardápio & Preços').checked).toBe(true);

    caixa(el, 'Tudo em Pedidos & Cozinha').click();
    fixture.detectChanges();
    expect(c.marcadas()['pedidos']).toEqual(['ver', 'editar']);

    caixa(el, 'Ver Cardápio & Preços').click();
    fixture.detectChanges();
    expect(c.marcadas()['cardapio']).toEqual([]);
  });

  it('cria perfil com as permissões marcadas e recarrega a lista', () => {
    const { fixture, http, c, el } = montar();
    c.novo();
    c.nome = 'Gerente';
    c.alternar('dashboard', 'ver');
    c.alternar('cardapio', 'criar');
    fixture.detectChanges();
    c.salvar();
    c.salvar();
    const req = http.expectOne({ method: 'POST', url: `${API_BASE}/perfis` });
    expect(req.request.body).toEqual({
      nome: 'Gerente',
      permissoes: { dashboard: ['ver'], cardapio: ['ver', 'criar'] },
    });
    req.flush({ perfil: { id: 9 } }, { status: 201, statusText: 'Created' });
    http.expectOne(`${API_BASE}/perfis`).flush({ perfis: PERFIS, telas: TELAS });
    fixture.detectChanges();
    expect(el.textContent).toContain('Perfil criado.');
    expect(c.editando()).toBeNull();
    http.verify();
  });

  it('não salva sem nenhuma tela e mostra o erro de validação da API', () => {
    const { fixture, http, c, el } = montar();
    c.editar(PERFIS[1] as never);
    c.alternar('pedidos', 'ver');
    fixture.detectChanges();
    expect(el.textContent).toContain('Marque ao menos uma tela');
    c.salvar();
    http.expectNone({ method: 'PUT', url: `${API_BASE}/perfis/5` });

    c.alternar('pedidos', 'ver');
    c.nome = 'Operador';
    c.salvar();
    http
      .expectOne({ method: 'PUT', url: `${API_BASE}/perfis/5` })
      .flush(
        { message: 'erro', errors: { nome: ['O campo nome já está sendo utilizado.'] } },
        { status: 422, statusText: 'Unprocessable' },
      );
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('já está sendo utilizado');
    expect(c.editando()).toBe(5);
    http.verify();
  });
});
