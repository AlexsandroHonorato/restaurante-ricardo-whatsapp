import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { LoginComponent } from './login.component';

describe('Tela de login BotClient', () => {
  let login: ReturnType<typeof vi.fn>;
  let navegar: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    localStorage.clear();
    login = vi.fn();
    navegar = vi.fn().mockResolvedValue(true);
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthService, useValue: { login } },
        { provide: Router, useValue: { navigateByUrl: navegar } },
      ],
    }).compileComponents();
  });

  async function montar() {
    const fixture = TestBed.createComponent(LoginComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  async function preencher(
    fixture: Awaited<ReturnType<typeof montar>>['fixture'],
    email: string,
    senha: string,
  ) {
    const el = fixture.nativeElement as HTMLElement;
    const campoEmail = el.querySelector('#email') as HTMLInputElement;
    const campoSenha = el.querySelector('#password') as HTMLInputElement;
    campoEmail.value = email;
    campoEmail.dispatchEvent(new Event('input'));
    campoSenha.value = senha;
    campoSenha.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function enviar(fixture: Awaited<ReturnType<typeof montar>>['fixture']) {
    (fixture.nativeElement as HTMLElement)
      .querySelector('form')!
      .dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('mostra a marca BotClient', async () => {
    const { el } = await montar();
    expect(el.textContent).toContain('BotClient');
  });

  it('bloqueia envio com e-mail inválido e senha vazia, com as mesmas mensagens', async () => {
    const { fixture, el } = await montar();
    await preencher(fixture, 'invalido', '');
    await enviar(fixture);
    expect(login).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Informe um e-mail válido.');
    expect(el.textContent).toContain('Informe sua senha.');
  });

  it('mantém limites de tamanho e autocomplete dos campos', async () => {
    const { el } = await montar();
    const email = el.querySelector('#email') as HTMLInputElement;
    const senha = el.querySelector('#password') as HTMLInputElement;
    expect(email.getAttribute('maxlength')).toBe('254');
    expect(email.getAttribute('autocomplete')).toBe('username');
    expect(senha.getAttribute('maxlength')).toBe('128');
    expect(senha.getAttribute('autocomplete')).toBe('current-password');
  });

  it('normaliza o e-mail, entra e limpa a senha', async () => {
    login.mockReturnValue(of({ user: {} }));
    const { fixture } = await montar();
    await preencher(fixture, '  Admin@Example.com ', 'Senha123!');
    await enviar(fixture);
    expect(login).toHaveBeenCalledWith('admin@example.com', 'Senha123!');
    expect(navegar).toHaveBeenCalledWith('/dashboard');
    expect(fixture.componentInstance.senha).toBe('');
  });

  it.each([
    [429, 'Muitas tentativas. Aguarde um minuto e tente novamente.'],
    [422, 'E-mail ou senha inválidos.'],
    [0, 'Não foi possível entrar. Verifique a conexão e tente novamente.'],
  ])('traduz erro HTTP %i para mensagem amigável', async (status, mensagem) => {
    login.mockReturnValue(throwError(() => ({ status })));
    const { fixture, el } = await montar();
    await preencher(fixture, 'admin@example.com', 'Senha123!');
    await enviar(fixture);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(mensagem);
    expect(navegar).not.toHaveBeenCalled();
  });

  it('alterna a visibilidade da senha com nome acessível', async () => {
    const { fixture, el } = await montar();
    const botao = el.querySelector('.password-toggle') as HTMLButtonElement;
    expect(botao.getAttribute('aria-label')).toBe('Exibir senha');
    botao.click();
    fixture.detectChanges();
    expect((el.querySelector('#password') as HTMLInputElement).type).toBe('text');
    expect(botao.getAttribute('aria-label')).toBe('Ocultar senha');
  });

  it('lembra o e-mail somente quando marcado', async () => {
    login.mockReturnValue(of({ user: {} }));
    const { fixture, el } = await montar();
    await preencher(fixture, 'admin@example.com', 'Senha123!');
    (el.querySelector('#lembrar-email') as HTMLInputElement).click();
    await enviar(fixture);
    expect(localStorage.getItem('botclient_lembrar_email')).toBe('admin@example.com');

    const segunda = await montar();
    expect((segunda.el.querySelector('#email') as HTMLInputElement).value).toBe(
      'admin@example.com',
    );
  });
});
