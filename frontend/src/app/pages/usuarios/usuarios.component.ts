import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule, NgForm } from '@angular/forms';
import { API_BASE, SystemUser } from '../../core/services/session-state';
import { criteriosSenha } from '../../shared/ui/password-rules';
import { IconComponent } from '../../shared/ui/icon.component';
@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [FormsModule, IconComponent],
  template: `
    <h1 class="page-title">Usuários do sistema</h1>
    <p class="page-subtitle">Gerencie quem tem acesso ao restaurante.</p>
    <div class="users-layout">
      <section class="glass-card user-form">
        <h2><app-icon nome="adicionar" /> Cadastrar usuário</h2>
        <form #form="ngForm" (ngSubmit)="salvar(form)" novalidate>
          <div class="form-grid">
            <label
              >Nome completo<input
                name="name"
                [(ngModel)]="dados.name"
                required
                minlength="3"
                maxlength="150"
                autocomplete="name"
            /></label>
            <label
              >E-mail<input
                name="email"
                [(ngModel)]="dados.email"
                type="email"
                required
                email
                maxlength="254"
                autocomplete="email"
            /></label>
            <label
              >Telefone (opcional)<input
                name="phone"
                [(ngModel)]="dados.phone"
                type="tel"
                maxlength="20"
                pattern="[+0-9 ()-]{10,20}"
                autocomplete="tel"
            /></label>
            <label
              >Perfil<select name="role" [(ngModel)]="dados.role">
                <option value="operador">Operador</option>
                <option value="admin">Administrador</option>
              </select></label
            >
            <label
              >Status<select name="active" [(ngModel)]="dados.active">
                <option [ngValue]="true">Ativo</option>
                <option [ngValue]="false">Inativo</option>
              </select></label
            >
            <div>
              <label for="user-password">Senha</label>
              <div class="password-wrap">
                <input
                  id="user-password"
                  name="password"
                  [(ngModel)]="dados.password"
                  [type]="mostrar() ? 'text' : 'password'"
                  required
                  maxlength="72"
                  autocomplete="new-password"
                /><button type="button" (click)="mostrar.set(!mostrar())">
                  {{ mostrar() ? 'Ocultar' : 'Mostrar' }}
                </button>
              </div>
            </div>
            <label
              >Confirmar senha<input
                name="password_confirmation"
                [(ngModel)]="dados.password_confirmation"
                [type]="mostrar() ? 'text' : 'password'"
                required
                maxlength="72"
                autocomplete="new-password"
            /></label>
          </div>
          <div class="password-strength" aria-live="polite">
            <span>Força da senha: {{ pontos() }}/5</span>
            <div class="strength-bars">
              @for (ok of regras(); track $index) {
                <i [class.filled]="pontos() > $index"></i>
              }
            </div>
            <ul>
              @for (texto of criterios; track $index) {
                <li [class.valid]="regras()[$index]">
                  {{ regras()[$index] ? '✓' : '○' }} {{ texto }}
                </li>
              }
            </ul>
          </div>
          @if (form.submitted && (form.invalid || pontos() < 5)) {
            <p role="alert" class="error">Revise os campos e cumpra os cinco critérios da senha.</p>
          }
          @if (form.submitted && dados.password !== dados.password_confirmation) {
            <p role="alert" class="error">As senhas não coincidem.</p>
          }
          @if (erro()) {
            <p role="alert" class="error">{{ erro() }}</p>
          }
          @if (sucesso()) {
            <p role="status" class="success">{{ sucesso() }}</p>
          }
          <button class="btn btn-primary" type="submit" [disabled]="salvando()">
            <app-icon nome="confirmar" /> {{ salvando() ? 'Salvando…' : 'Cadastrar usuário' }}
          </button>
        </form>
      </section>
      <section class="glass-card user-list">
        <h2><app-icon nome="clientes" /> Equipe cadastrada</h2>
        @if (carregando()) {
          <p>Carregando usuários…</p>
        }
        @for (user of usuarios(); track user.id) {
          <article>
            <div class="avatar"><app-icon nome="clientes" /></div>
            <div>
              <strong>{{ user.name }}</strong
              ><span>{{ user.email }}</span
              ><small
                >{{ user.role === 'admin' ? 'Administrador' : 'Operador' }} ·
                {{ user.active ? 'Ativo' : 'Inativo' }}</small
              >
            </div>
          </article>
        }
        @if (!carregando() && !usuarios().length) {
          <p>Nenhum usuário encontrado.</p>
        }
        @if (total() > usuarios().length) {
          <button class="btn btn-secondary" (click)="mais()" [disabled]="carregando()">
            Carregar mais
          </button>
        }
      </section>
    </div>
  `,
  styleUrl: './usuarios.component.css',
})
export class UsuariosComponent implements OnInit {
  private http = inject(HttpClient);
  usuarios = signal<SystemUser[]>([]);
  total = signal(0);
  carregando = signal(false);
  salvando = signal(false);
  mostrar = signal(false);
  erro = signal('');
  sucesso = signal('');
  private pagina = 1;
  dados = this.novo();
  criterios = [
    'Mínimo de 8 caracteres',
    'Uma letra maiúscula',
    'Uma letra minúscula',
    'Um número',
    'Um símbolo',
  ];
  novo() {
    return {
      name: '',
      email: '',
      phone: '',
      role: 'operador',
      active: true,
      password: '',
      password_confirmation: '',
    };
  }
  regras() {
    return criteriosSenha(this.dados.password);
  }
  pontos() {
    return this.regras().filter(Boolean).length;
  }
  ngOnInit() {
    this.listar();
  }
  listar() {
    this.carregando.set(true);
    this.http
      .get<{ data: { data: SystemUser[]; total: number } }>(
        API_BASE + '/usuarios?page=' + this.pagina,
      )
      .subscribe({
        next: (r) => {
          this.usuarios.update((lista) =>
            this.pagina === 1 ? r.data.data : [...lista, ...r.data.data],
          );
          this.total.set(r.data.total);
          this.carregando.set(false);
        },
        error: () => {
          this.erro.set('Não foi possível carregar a equipe.');
          this.carregando.set(false);
        },
      });
  }
  mais() {
    this.pagina++;
    this.listar();
  }
  salvar(form: NgForm) {
    if (
      form.invalid ||
      this.pontos() < 5 ||
      this.dados.password !== this.dados.password_confirmation ||
      this.salvando()
    )
      return;
    this.salvando.set(true);
    this.erro.set('');
    this.sucesso.set('');
    this.http
      .post(API_BASE + '/usuarios', {
        ...this.dados,
        email: this.dados.email.trim().toLowerCase(),
        phone: this.dados.phone || null,
      })
      .subscribe({
        next: () => {
          this.salvando.set(false);
          this.dados = this.novo();
          form.resetForm(this.dados);
          this.sucesso.set('Usuário cadastrado com sucesso.');
          this.pagina = 1;
          this.listar();
        },
        error: (e) => {
          this.salvando.set(false);
          this.erro.set(
            Object.values(e.error?.errors || {})
              .flat()
              .join(' ') || 'Não foi possível cadastrar. Tente novamente.',
          );
        },
      });
  }
}
