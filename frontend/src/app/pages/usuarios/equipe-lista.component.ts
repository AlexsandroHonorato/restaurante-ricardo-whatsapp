import { Component, computed, input, output, signal } from '@angular/core';
import { SystemUser } from '../../core/services/session-state';
import { IconComponent } from '../../shared/ui/icon.component';

const normalizar = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Lista "Equipe cadastrada": busca e filtros locais; editar/excluir ficam com a página. */
@Component({
  selector: 'app-equipe-lista',
  standalone: true,
  imports: [IconComponent],
  template: `
    <header class="equipe-topo">
      <h2><app-icon nome="clientes" /> Equipe cadastrada</h2>
      @if (usuarios().length) {
        <p class="resumo">
          {{ total() }} {{ total() === 1 ? 'pessoa' : 'pessoas' }} · {{ admins() }}
          {{ admins() === 1 ? 'administrador' : 'administradores' }}
          @if (inativos()) {
            · {{ inativos() }} {{ inativos() === 1 ? 'inativo' : 'inativos' }}
          }
        </p>
      }
    </header>

    <div class="equipe-filtros">
      <input
        type="search"
        aria-label="Buscar na equipe"
        placeholder="Buscar por nome, e-mail ou telefone"
        [value]="busca()"
        (input)="busca.set($any($event.target).value)"
      />
      <select
        aria-label="Filtrar por perfil"
        [value]="perfil()"
        (change)="perfil.set($any($event.target).value)"
      >
        <option value="">Todos os perfis</option>
        @for (nome of perfisNaLista(); track nome) {
          <option [value]="nome">{{ nome }}</option>
        }
      </select>
      <select
        aria-label="Filtrar por status"
        [value]="status()"
        (change)="status.set($any($event.target).value)"
      >
        <option value="">Todos os status</option>
        <option value="ativo">Ativos</option>
        <option value="inativo">Inativos</option>
      </select>
    </div>

    @if (erro()) {
      <div class="equipe-erro" role="alert">
        <span>{{ erro() }}</span>
        <button type="button" class="btn btn-secondary btn-sm" (click)="recarregar.emit()">
          Tentar novamente
        </button>
      </div>
    }

    <ul class="equipe" aria-label="Equipe">
      @for (user of filtrados(); track user.id) {
        <li
          class="membro"
          [class.selecionado]="editandoId() === user.id"
          [class.inativo]="!user.active"
        >
          <span class="avatar" [class.admin]="user.role === 'admin'" aria-hidden="true">{{
            iniciais(user.name)
          }}</span>
          <div class="membro-info">
            <strong class="nome">{{ user.name }}</strong>
            <span class="contato">
              {{ user.email }}
              @if (user.phone) {
                · {{ user.phone }}
              }
            </span>
            <span class="selos">
              <span class="selo" [class.admin]="user.role === 'admin'">{{ nomePerfil(user) }}</span>
              <span class="selo" [class.ativo]="user.active" [class.desligado]="!user.active">{{
                user.active ? 'Ativo' : 'Inativo'
              }}</span>
              @if (user.id === meuId()) {
                <span class="selo voce">Você</span>
              }
            </span>
          </div>
          <div class="acoes">
            @if (podeEditar()) {
              <button
                type="button"
                class="action-btn"
                [attr.aria-label]="'Editar ' + user.name"
                [title]="protegido(user) ? 'Só um administrador altera esta conta' : 'Editar'"
                [disabled]="protegido(user)"
                (click)="editar.emit(user)"
              >
                <app-icon nome="editar" />
              </button>
            }
            @if (podeExcluir()) {
              <button
                type="button"
                class="action-btn delete"
                [attr.aria-label]="'Excluir ' + user.name"
                [title]="
                  user.id === meuId()
                    ? 'Você não pode excluir a própria conta'
                    : protegido(user)
                      ? 'Só um administrador exclui esta conta'
                      : 'Excluir'
                "
                [disabled]="user.id === meuId() || protegido(user) || excluindoId() === user.id"
                (click)="excluir.emit(user)"
              >
                <app-icon nome="excluir" />
              </button>
            }
          </div>
        </li>
      }
    </ul>

    @if (carregando()) {
      <p class="vazio" role="status">Carregando usuários…</p>
    } @else if (!filtrados().length && !erro()) {
      <p class="vazio">
        {{ filtrando() ? 'Ninguém encontrado com esses filtros.' : 'Nenhum usuário cadastrado.' }}
        @if (filtrando()) {
          <button type="button" class="btn btn-secondary btn-sm" (click)="limpar()">
            Limpar filtros
          </button>
        }
      </p>
    }
    @if (total() > usuarios().length) {
      <button class="btn btn-secondary mais" (click)="mais.emit()" [disabled]="carregando()">
        Carregar mais ({{ total() - usuarios().length }} restantes)
      </button>
    }
  `,
  styleUrl: './equipe-lista.component.css',
})
export class EquipeListaComponent {
  usuarios = input.required<SystemUser[]>();
  total = input(0);
  carregando = input(false);
  erro = input('');
  meuId = input<number | undefined>();
  editandoId = input<number | undefined>();
  excluindoId = input<number | null>(null);
  /** Permissões de quem está vendo a lista. Conta de administrador só é alterada por outro administrador. */
  souAdmin = input(true);
  podeEditar = input(true);
  podeExcluir = input(true);
  editar = output<SystemUser>();
  excluir = output<SystemUser>();
  mais = output<void>();
  recarregar = output<void>();

  busca = signal('');
  perfil = signal('');
  status = signal<'' | 'ativo' | 'inativo'>('');

  admins = computed(() => this.usuarios().filter((u) => u.role === 'admin').length);
  inativos = computed(() => this.usuarios().filter((u) => !u.active).length);
  filtrando = computed(() => !!(this.busca().trim() || this.perfil() || this.status()));
  filtrados = computed(() => {
    const busca = normalizar(this.busca().trim());
    const digitos = busca.replace(/\D/g, '');
    return this.usuarios().filter(
      (u) =>
        (!this.perfil() || this.nomePerfil(u) === this.perfil()) &&
        (!this.status() || u.active === (this.status() === 'ativo')) &&
        (!busca ||
          normalizar(`${u.name} ${u.email}`).includes(busca) ||
          (!!digitos && (u.phone ?? '').replace(/\D/g, '').includes(digitos))),
    );
  });

  perfisNaLista = computed(() =>
    [...new Set(this.usuarios().map((u) => this.nomePerfil(u)))].sort((a, b) =>
      a.localeCompare(b, 'pt-BR'),
    ),
  );

  nomePerfil(user: SystemUser) {
    return user.role === 'admin' ? 'Administrador' : (user.perfil?.nome ?? 'Operador');
  }

  protegido(user: SystemUser) {
    return user.role === 'admin' && !this.souAdmin();
  }

  iniciais(nome: string) {
    const partes = nome.trim().split(/\s+/);
    return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes.at(-1)![0] : '')).toUpperCase();
  }

  limpar() {
    this.busca.set('');
    this.perfil.set('');
    this.status.set('');
  }
}
