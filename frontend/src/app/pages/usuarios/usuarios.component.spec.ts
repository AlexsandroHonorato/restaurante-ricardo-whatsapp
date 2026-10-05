import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { UsuariosComponent } from './usuarios.component';
import { API_BASE, SessionState, SystemUser } from '../../core/services/session-state';
import { ConfirmacaoService, PedidoConfirmacao } from '../../shared/ui/confirmacao.service';

const EU: SystemUser = {
  id: 1,
  name: 'Admin',
  email: 'admin@x.com',
  phone: null,
  role: 'admin',
  active: true,
};
const ANA: SystemUser = {
  id: 2,
  name: 'Ana Lima',
  email: 'ana@x.com',
  phone: '5512997500045',
  role: 'operador',
  active: true,
  perfil_id: 5,
  perfil: { id: 5, nome: 'Cozinha' },
};

// Modal de decisão: nos testes confirma na hora e guarda o que foi perguntado.
const pedir = vi.fn((_pedido: PedidoConfirmacao, aoConfirmar: () => void) => aoConfirmar());

const PERFIS = [
  { id: 1, nome: 'Operador', padrao: true },
  { id: 5, nome: 'Cozinha', padrao: false },
];

async function montar(eu: SystemUser = EU) {
  pedir.mockClear();
  TestBed.configureTestingModule({
    imports: [UsuariosComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: SessionState, useValue: { user: signal(eu), csrf: signal('') } },
      { provide: ConfirmacaoService, useValue: { pedir } },
    ],
  });
  const fixture = TestBed.createComponent(UsuariosComponent);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  http.expectOne(`${API_BASE}/usuarios?page=1`).flush({ data: { data: [EU, ANA], total: 2 } });
  http.expectOne(`${API_BASE}/perfis`).flush({ perfis: PERFIS });
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, http, el: fixture.nativeElement as HTMLElement };
}
const botao = (el: HTMLElement, rotulo: string) =>
  el.querySelector(`[aria-label="${rotulo}"]`) as HTMLButtonElement;
const campo = (el: HTMLElement, nome: string) =>
  el.querySelector(`[name="${nome}"]`) as HTMLInputElement;

describe('Usuários do sistema', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('telefone recebe máscara enquanto digita', async () => {
    const { fixture, el } = await montar();
    const tel = campo(el, 'phone');
    tel.value = '12997500045';
    tel.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(tel.value).toBe('(12) 99750-0045');
    expect(fixture.componentInstance.dados.phone).toBe('(12) 99750-0045');
    expect(el.textContent).not.toContain('Telefone incompleto');

    tel.value = '1299';
    tel.dispatchEvent(new Event('input'));
    tel.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(tel.value).toBe('(12) 99');
    expect(el.textContent).toContain('Telefone incompleto');
  });

  it('edita sem trocar a senha e envia PUT só com os dados', async () => {
    const { fixture, http, el } = await montar();
    botao(el, 'Editar Ana Lima').click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('Editar usuário');
    expect(campo(el, 'phone').value).toBe('(12) 99750-0045'); // número antigo com 55 ganha a máscara
    campo(el, 'name').value = 'Ana Souza';
    campo(el, 'name').dispatchEvent(new Event('input'));
    (el.querySelector('form button[type="submit"]') as HTMLButtonElement).click();
    expect(pedir.mock.calls[0][0].titulo).toBe('Salvar alterações?');
    const req = http.expectOne({ method: 'PUT', url: `${API_BASE}/usuarios/2` });
    // O campo Perfil vira role + perfil_id; "Cozinha" continua sendo o perfil dela.
    expect(el.textContent).toContain('Cozinha');
    expect(req.request.body).toMatchObject({
      name: 'Ana Souza',
      password: '',
      role: 'operador',
      perfil_id: 5,
    });
    expect(req.request.body.perfil).toBeUndefined();
    req.flush({ user: { ...ANA, name: 'Ana Souza' } });
    http.expectOne(`${API_BASE}/usuarios?page=1`).flush({ data: { data: [EU], total: 1 } });
    fixture.detectChanges();
    expect(el.textContent).toContain('Alterações salvas.');
    expect(el.textContent).toContain('Cadastrar usuário');
  });

  it('exclui após confirmar; a própria conta não pode ser excluída nem rebaixada', async () => {
    const { fixture, http, el } = await montar();
    expect(botao(el, 'Excluir Admin').disabled).toBe(true);
    botao(el, 'Editar Admin').click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(campo(el, 'perfil').disabled).toBe(true);
    expect(campo(el, 'active').disabled).toBe(true);

    botao(el, 'Excluir Ana Lima').click();
    expect(pedir.mock.calls[0][0].mensagem).toContain('Ana Lima');
    expect(pedir.mock.calls[0][0].perigo).toBe(true);
    http.expectOne({ method: 'DELETE', url: `${API_BASE}/usuarios/2` }).flush({ ok: true });
    http.expectOne(`${API_BASE}/usuarios?page=1`).flush({ data: { data: [EU], total: 1 } });
    fixture.detectChanges();
    expect(el.textContent).toContain('Usuário Ana Lima excluído.');
    expect(el.textContent).not.toContain('ana@x.com');
    http.verify();
  });

  it('perfil que só vê e edita: sem cadastro, sem excluir, sem tocar em administrador', async () => {
    const gerente: SystemUser = {
      ...ANA,
      id: 3,
      name: 'Gerente',
      permissoes: { usuarios: ['ver', 'editar'] },
    };
    const { el } = await montar(gerente);
    // Sem "criar": formulário de cadastro escondido. Sem "excluir": nenhum botão de excluir.
    expect((el.querySelector('.user-form') as HTMLElement).hidden).toBe(true);
    expect(botao(el, 'Excluir Ana Lima')).toBeNull();
    // Conta de administrador só é alterada por outro administrador.
    expect(botao(el, 'Editar Admin').disabled).toBe(true);
    expect(botao(el, 'Editar Ana Lima').disabled).toBe(false);
    // Quem não é administrador não pode conceder o perfil Administrador.
    expect(el.querySelector('select[name="perfil"] option[value="admin"]')).toBeNull();
  });
});
