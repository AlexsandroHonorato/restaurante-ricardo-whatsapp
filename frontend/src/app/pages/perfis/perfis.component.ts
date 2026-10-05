import { Component, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { API_BASE } from '../../core/services/session-state';
import { Acao, TELAS } from '../../core/permissoes';
import { ConfirmacaoService } from '../../shared/ui/confirmacao.service';
import { IconComponent } from '../../shared/ui/icon.component';

interface Perfil {
  id: number;
  nome: string;
  permissoes: Record<string, string[]>;
  padrao: boolean;
  usuarios_count: number;
}

const ACOES: { id: Acao; nome: string }[] = [
  { id: 'ver', nome: 'Ver' },
  { id: 'criar', nome: 'Criar' },
  { id: 'editar', nome: 'Editar' },
  { id: 'excluir', nome: 'Excluir' },
];

/** O que "editar" cobre nas telas em que a ação não é só cadastro. */
const DICAS: Record<string, string> = {
  pedidos:
    'Editar: mudar status, cancelar e imprimir comanda. Excluir: apaga o pedido definitivamente.',
  atendimentos:
    'Editar: responder o cliente, pausar o bot e dispensar avisos. Excluir: alertas e conversas.',
  clientes: 'Excluir: apagar os dados pessoais do cliente (LGPD).',
  cardapio: 'Editar: inclui pausar/ativar prato e mudar os dias.',
};

/**
 * Perfis de usuário (Configurações, só Administrador): o que cada perfil vê e faz no painel.
 * A API confere a permissão em cada ação; esta tela só define a grade.
 */
@Component({
  selector: 'app-perfis',
  imports: [FormsModule, IconComponent],
  templateUrl: './perfis.component.html',
  styleUrl: './perfis.component.css',
})
export class PerfisComponent {
  private http = inject(HttpClient);
  private confirmacao = inject(ConfirmacaoService);
  acoes = ACOES;
  dicas = DICAS;
  perfis = signal<Perfil[]>([]);
  /** Ações que existem em cada tela (vem da API). */
  catalogo = signal<Record<string, string[]>>({});
  telas = computed(() => TELAS.filter((tela) => this.catalogo()[tela.id]));
  carregando = signal(true);
  salvando = signal(false);
  erro = signal('');
  sucesso = signal('');
  /** null = formulário fechado; id 0 = perfil novo. */
  editando = signal<number | null>(null);
  nome = '';
  marcadas = signal<Record<string, string[]>>({});

  constructor() {
    this.carregar();
  }

  carregar() {
    this.carregando.set(true);
    this.http
      .get<{ perfis: Perfil[]; telas: Record<string, string[]> }>(`${API_BASE}/perfis`)
      .subscribe({
        next: (r) => {
          this.perfis.set(r.perfis);
          this.catalogo.set(r.telas);
          this.carregando.set(false);
        },
        error: () => {
          this.carregando.set(false);
          this.erro.set('Não foi possível carregar os perfis.');
        },
      });
  }

  novo() {
    this.abrir(0, '', {});
  }

  editar(perfil: Perfil) {
    this.abrir(perfil.id, perfil.nome, perfil.permissoes);
  }

  private abrir(id: number, nome: string, permissoes: Record<string, string[]>) {
    this.editando.set(id);
    this.nome = nome;
    this.marcadas.set(
      Object.fromEntries(Object.entries(permissoes).map(([tela, acoes]) => [tela, [...acoes]])),
    );
    this.erro.set('');
    this.sucesso.set('');
  }

  fechar() {
    this.editando.set(null);
  }

  existe(tela: string, acao: string) {
    return !!this.catalogo()[tela]?.includes(acao);
  }

  marcada(tela: string, acao: string) {
    return !!this.marcadas()[tela]?.includes(acao);
  }

  /** Criar, editar ou excluir marcam "ver" junto; desmarcar "ver" tira a tela inteira do perfil. */
  alternar(tela: string, acao: string) {
    const atuais = new Set(this.marcadas()[tela] ?? []);
    if (atuais.has(acao)) {
      if (acao === 'ver') atuais.clear();
      else atuais.delete(acao);
    } else {
      atuais.add(acao).add('ver');
    }
    const ordenadas = (this.catalogo()[tela] ?? []).filter((a) => atuais.has(a));
    this.marcadas.update((todas) => ({ ...todas, [tela]: ordenadas }));
  }

  telaInteira(tela: string) {
    const todas = this.catalogo()[tela] ?? [];
    return todas.length > 0 && todas.every((acao) => this.marcada(tela, acao));
  }

  alternarTela(tela: string) {
    const todas = this.catalogo()[tela] ?? [];
    this.marcadas.update((m) => ({ ...m, [tela]: this.telaInteira(tela) ? [] : [...todas] }));
  }

  temTela = computed(() => Object.values(this.marcadas()).some((acoes) => acoes.includes('ver')));

  resumo(perfil: Perfil) {
    const nomes = TELAS.filter((tela) => perfil.permissoes[tela.id]?.includes('ver')).map(
      (tela) => tela.nome,
    );
    return nomes.length ? nomes.join(' · ') : 'Nenhuma tela';
  }

  salvar() {
    const nome = this.nome.trim();
    const id = this.editando();
    if (id === null || nome.length < 2 || !this.temTela() || this.salvando()) return;
    this.confirmacao.pedir(
      id
        ? {
            titulo: 'Salvar alterações do perfil?',
            mensagem: `As permissões de "${nome}" mudam para todos os usuários deste perfil. Quem já está logado vê a mudança no próximo acesso.`,
            confirmar: 'Salvar alterações',
          }
        : {
            titulo: 'Criar perfil?',
            mensagem: `O perfil "${nome}" ficará disponível no cadastro de usuários.`,
            confirmar: 'Criar perfil',
          },
      () => this.salvarConfirmado(id, nome),
    );
  }

  private salvarConfirmado(id: number, nome: string) {
    if (this.salvando()) return;
    this.salvando.set(true);
    this.erro.set('');
    const corpo = { nome, permissoes: this.marcadas() };
    const requisicao = id
      ? this.http.put(`${API_BASE}/perfis/${id}`, corpo)
      : this.http.post(`${API_BASE}/perfis`, corpo);
    requisicao.subscribe({
      next: () => {
        this.salvando.set(false);
        this.editando.set(null);
        this.sucesso.set(id ? 'Perfil atualizado.' : 'Perfil criado.');
        this.carregar();
      },
      error: (e: HttpErrorResponse) => {
        this.salvando.set(false);
        this.erro.set(this.mensagemErro(e, 'Não foi possível salvar o perfil. Tente novamente.'));
      },
    });
  }

  excluir(perfil: Perfil) {
    this.confirmacao.pedir(
      {
        titulo: 'Excluir perfil?',
        mensagem: `O perfil "${perfil.nome}" será excluído.`,
        confirmar: 'Excluir perfil',
        perigo: true,
      },
      () => {
        this.erro.set('');
        this.sucesso.set('');
        this.http.delete(`${API_BASE}/perfis/${perfil.id}`).subscribe({
          next: () => {
            if (this.editando() === perfil.id) this.editando.set(null);
            this.sucesso.set(`Perfil ${perfil.nome} excluído.`);
            this.carregar();
          },
          error: (e: HttpErrorResponse) =>
            this.erro.set(this.mensagemErro(e, 'Não foi possível excluir o perfil.')),
        });
      },
    );
  }

  private mensagemErro(e: HttpErrorResponse, padrao: string) {
    return (
      Object.values<string[]>(e.error?.errors ?? {})
        .flat()
        .join(' ') || padrao
    );
  }
}
