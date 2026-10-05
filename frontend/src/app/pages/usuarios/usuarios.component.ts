import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule, NgForm } from '@angular/forms';
import { API_BASE, SessionState, SystemUser } from '../../core/services/session-state';
import { criteriosSenha } from '../../shared/ui/password-rules';
import { IconComponent } from '../../shared/ui/icon.component';
import {
  MascaraTelefoneDirective,
  mascararTelefone,
} from '../../shared/ui/mascara-telefone.directive';
import { EquipeListaComponent } from './equipe-lista.component';
@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [FormsModule, IconComponent, MascaraTelefoneDirective, EquipeListaComponent],
  template: `
    <h1 class="page-title">Usuários do sistema</h1>
    <p class="page-subtitle">Gerencie quem tem acesso ao restaurante.</p>
    <div class="users-layout">
      <section class="glass-card user-form">
        <h2>
          <app-icon [nome]="editando() ? 'editar' : 'adicionar'" />
          {{ editando() ? 'Editar usuário' : 'Cadastrar usuário' }}
        </h2>
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
                #telefone="ngModel"
                appMascaraTelefone
                type="tel"
                inputmode="numeric"
                maxlength="15"
                placeholder="(12) 99999-9999"
                pattern="\\(\\d{2}\\) \\d{4,5}-\\d{4}"
                autocomplete="tel"
              />
              @if (telefone.invalid && (telefone.touched || form.submitted)) {
                <small class="error">Telefone incompleto: (12) 99999-9999 ou (12) 3333-4444.</small>
              }
            </label>
            <label
              >Perfil<select name="role" [(ngModel)]="dados.role" [disabled]="ehEu(editando())">
                <option value="operador">Operador</option>
                <option value="admin">Administrador</option>
              </select></label
            >
            <label
              >Status<select name="active" [(ngModel)]="dados.active" [disabled]="ehEu(editando())">
                <option [ngValue]="true">Ativo</option>
                <option [ngValue]="false">Inativo</option>
              </select></label
            >
            <div>
              <label for="user-password">{{ editando() ? 'Nova senha' : 'Senha' }}</label>
              <div class="password-wrap">
                <input
                  id="user-password"
                  name="password"
                  [(ngModel)]="dados.password"
                  [type]="mostrar() ? 'text' : 'password'"
                  [required]="!editando()"
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
                [required]="!editando()"
                maxlength="72"
                autocomplete="new-password"
            /></label>
          </div>
          @if (editando()) {
            <p class="hint">Deixe a senha em branco para manter a atual.</p>
          }
          @if (trocandoSenha()) {
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
          }
          @if (form.submitted && (form.invalid || (trocandoSenha() && pontos() < 5))) {
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
          <div class="form-actions">
            <button class="btn btn-primary" type="submit" [disabled]="salvando()">
              <app-icon nome="confirmar" />
              {{
                salvando() ? 'Salvando…' : editando() ? 'Salvar alterações' : 'Cadastrar usuário'
              }}
            </button>
            @if (editando()) {
              <button type="button" class="btn btn-secondary" (click)="cancelarEdicao(form)">
                Cancelar edição
              </button>
            }
          </div>
        </form>
      </section>
      <section class="glass-card user-list">
        <app-equipe-lista
          [usuarios]="usuarios()"
          [total]="total()"
          [carregando]="carregando()"
          [erro]="erroLista()"
          [meuId]="sessao.user()?.id"
          [editandoId]="editando()?.id"
          [excluindoId]="excluindo()"
          (editar)="editar($event, form)"
          (excluir)="excluir($event, form)"
          (mais)="mais()"
          (recarregar)="recarregar()"
        />
      </section>
    </div>
  `,
  styleUrl: './usuarios.component.css',
})
export class UsuariosComponent implements OnInit {
  private http = inject(HttpClient);
  sessao = inject(SessionState);
  usuarios = signal<SystemUser[]>([]);
  total = signal(0);
  carregando = signal(false);
  salvando = signal(false);
  excluindo = signal<number | null>(null);
  editando = signal<SystemUser | null>(null);
  mostrar = signal(false);
  erro = signal('');
  erroLista = signal('');
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
      role: 'operador' as SystemUser['role'],
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
  /** No cadastro a senha é obrigatória; na edição só vale se for preenchida. */
  trocandoSenha() {
    return !this.editando() || !!this.dados.password;
  }
  ehEu(user: SystemUser | null) {
    return !!user && user.id === this.sessao.user()?.id;
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
          this.erroLista.set('');
          this.carregando.set(false);
        },
        error: () => {
          this.erroLista.set('Não foi possível carregar a equipe.');
          this.carregando.set(false);
        },
      });
  }
  mais() {
    this.pagina++;
    this.listar();
  }
  recarregar() {
    this.pagina = 1;
    this.listar();
  }
  editar(user: SystemUser, form: NgForm) {
    this.editando.set(user);
    this.dados = {
      name: user.name,
      email: user.email,
      phone: mascararTelefone(user.phone),
      role: user.role,
      active: user.active,
      password: '',
      password_confirmation: '',
    };
    form.resetForm(this.dados);
    this.erro.set('');
    this.sucesso.set('');
  }
  cancelarEdicao(form: NgForm) {
    this.editando.set(null);
    this.dados = this.novo();
    form.resetForm(this.dados);
    this.erro.set('');
  }
  excluir(user: SystemUser, form: NgForm) {
    if (this.ehEu(user) || this.excluindo()) return;
    if (!confirm(`Excluir o acesso de "${user.name}"? A pessoa não conseguirá mais entrar.`))
      return;
    this.excluindo.set(user.id);
    this.erro.set('');
    this.sucesso.set('');
    this.http.delete(API_BASE + '/usuarios/' + user.id).subscribe({
      next: () => {
        this.excluindo.set(null);
        if (this.editando()?.id === user.id) this.cancelarEdicao(form);
        this.sucesso.set(`Usuário ${user.name} excluído.`);
        this.recarregar();
      },
      error: (e) => {
        this.excluindo.set(null);
        this.erro.set(this.mensagemErro(e, 'Não foi possível excluir. Tente novamente.'));
      },
    });
  }
  salvar(form: NgForm) {
    if (
      form.invalid ||
      (this.trocandoSenha() && this.pontos() < 5) ||
      this.dados.password !== this.dados.password_confirmation ||
      this.salvando()
    )
      return;
    this.salvando.set(true);
    this.erro.set('');
    this.sucesso.set('');
    const editando = this.editando();
    const corpo = {
      ...this.dados,
      email: this.dados.email.trim().toLowerCase(),
      phone: this.dados.phone || null,
    };
    const requisicao = editando
      ? this.http.put(API_BASE + '/usuarios/' + editando.id, corpo)
      : this.http.post(API_BASE + '/usuarios', corpo);
    requisicao.subscribe({
      next: () => {
        this.salvando.set(false);
        this.editando.set(null);
        this.dados = this.novo();
        form.resetForm(this.dados);
        this.sucesso.set(editando ? 'Alterações salvas.' : 'Usuário cadastrado com sucesso.');
        this.recarregar();
      },
      error: (e) => {
        this.salvando.set(false);
        this.erro.set(
          this.mensagemErro(
            e,
            editando
              ? 'Não foi possível salvar. Tente novamente.'
              : 'Não foi possível cadastrar. Tente novamente.',
          ),
        );
      },
    });
  }
  private mensagemErro(e: any, padrao: string) {
    return (
      Object.values(e.error?.errors || {})
        .flat()
        .join(' ') || padrao
    );
  }
}
