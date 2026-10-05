import { TestBed } from '@angular/core/testing';
import { EquipeListaComponent } from './equipe-lista.component';
import { SystemUser } from '../../core/services/session-state';

const u = (id: number, name: string, extra: Partial<SystemUser> = {}): SystemUser => ({
  id,
  name,
  email: `${name.split(' ')[0].toLowerCase()}@x.com`,
  phone: null,
  role: 'operador',
  active: true,
  ...extra,
});
const EQUIPE = [
  u(1, 'Admin Geral', { role: 'admin' }),
  u(2, 'Ana Lima', { phone: '(12) 99750-0045' }),
  u(3, 'Bruno Souza', { active: false }),
];

function montar(entradas: Record<string, unknown> = {}) {
  const fixture = TestBed.createComponent(EquipeListaComponent);
  fixture.componentRef.setInput('usuarios', EQUIPE);
  fixture.componentRef.setInput('total', 3);
  fixture.componentRef.setInput('meuId', 1);
  for (const [k, v] of Object.entries(entradas)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const nomes = () => [...el.querySelectorAll('.membro .nome')].map((n) => n.textContent?.trim());
  return { fixture, c: fixture.componentInstance, el, nomes };
}

describe('Equipe cadastrada', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('resume a equipe e mostra iniciais, selos e "Você"', () => {
    const { el } = montar();
    expect(el.querySelector('.resumo')?.textContent?.replace(/\s+/g, ' ')).toContain(
      '3 pessoas · 1 administrador · 1 inativo',
    );
    expect([...el.querySelectorAll('.avatar')].map((a) => a.textContent?.trim())).toEqual([
      'AG',
      'AL',
      'BS',
    ]);
    expect(el.querySelector('.membro')?.textContent).toContain('Você');
    expect(
      (el.querySelector('[aria-label="Excluir Admin Geral"]') as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(el.querySelectorAll('.membro.inativo').length).toBe(1);
  });

  it('busca por nome, e-mail ou telefone e filtra por perfil e status', () => {
    const { fixture, c, el, nomes } = montar();
    c.busca.set('ána');
    fixture.detectChanges();
    expect(nomes()).toEqual(['Ana Lima']);
    c.busca.set('99750');
    fixture.detectChanges();
    expect(nomes()).toEqual(['Ana Lima']);
    c.busca.set('');
    c.status.set('inativo');
    fixture.detectChanges();
    expect(nomes()).toEqual(['Bruno Souza']);
    c.perfil.set('admin');
    fixture.detectChanges();
    expect(el.textContent).toContain('Ninguém encontrado com esses filtros.');
    (el.querySelector('.vazio button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(nomes().length).toBe(3);
  });

  it('avisa editar/excluir e mostra erro com "Tentar novamente"', () => {
    const { fixture, c, el } = montar({ erro: 'Não foi possível carregar a equipe.' });
    const eventos: string[] = [];
    c.editar.subscribe((x) => eventos.push('editar ' + x.id));
    c.excluir.subscribe((x) => eventos.push('excluir ' + x.id));
    c.recarregar.subscribe(() => eventos.push('recarregar'));
    (el.querySelector('[aria-label="Editar Ana Lima"]') as HTMLButtonElement).click();
    (el.querySelector('[aria-label="Excluir Ana Lima"]') as HTMLButtonElement).click();
    (el.querySelector('.equipe-erro button') as HTMLButtonElement).click();
    expect(eventos).toEqual(['editar 2', 'excluir 2', 'recarregar']);
    fixture.componentRef.setInput('editandoId', 2);
    fixture.detectChanges();
    expect(el.querySelector('.membro.selecionado .nome')?.textContent).toContain('Ana Lima');
  });
});
