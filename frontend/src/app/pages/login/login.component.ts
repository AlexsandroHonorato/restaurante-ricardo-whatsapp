import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AnimatedLogoComponent } from '../../shared/brand/animated-logo.component';
import { LoginBackdropComponent } from './login-backdrop.component';

const CHAVE_LEMBRAR_EMAIL = 'botclient_lembrar_email';

/** Armazenamento pode estar bloqueado (aba privada, política do navegador); a tela funciona sem ele. */
function lerEmailLembrado(): string {
  try {
    return localStorage.getItem(CHAVE_LEMBRAR_EMAIL) ?? '';
  } catch {
    return '';
  }
}

function gravarEmailLembrado(email: string | null): void {
  try {
    if (email) localStorage.setItem(CHAVE_LEMBRAR_EMAIL, email);
    else localStorage.removeItem(CHAVE_LEMBRAR_EMAIL);
  } catch {
    /* sem armazenamento: apenas não lembra */
  }
}

function mensagemDeErro(status: number): string {
  if (status === 429) return 'Muitas tentativas. Aguarde um minuto e tente novamente.';
  if (status === 422) return 'E-mail ou senha inválidos.';
  return 'Não foi possível entrar. Verifique a conexão e tente novamente.';
}

@Component({
  selector: 'app-login',
  imports: [FormsModule, AnimatedLogoComponent, LoginBackdropComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  email = '';
  senha = '';
  mostrar = signal(false);
  carregando = signal(false);
  erro = signal('');
  lembrarEmail = signal(false);
  animacoesPausadas = signal(false);

  ngOnInit(): void {
    const salvo = lerEmailLembrado();
    if (salvo) {
      this.email = salvo;
      this.lembrarEmail.set(true);
    }
  }

  alternarLembrarEmail(marcado: boolean): void {
    this.lembrarEmail.set(marcado);
    if (!marcado) gravarEmailLembrado(null);
  }

  entrar(form: NgForm): void {
    if (form.invalid || this.carregando()) return;
    this.carregando.set(true);
    this.erro.set('');
    const email = this.email.trim().toLowerCase();
    this.auth.login(email, this.senha).subscribe({
      next: () => {
        this.senha = '';
        gravarEmailLembrado(this.lembrarEmail() ? email : null);
        this.carregando.set(false);
        void this.router.navigateByUrl('/');
      },
      error: (e: { status?: number }) => {
        this.carregando.set(false);
        this.erro.set(mensagemDeErro(e.status ?? 0));
      },
    });
  }
}
