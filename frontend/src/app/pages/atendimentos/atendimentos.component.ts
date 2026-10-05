import { IconComponent } from '../../shared/ui/icon.component';
import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService, ClienteSemResposta } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TransbordoService } from '../../core/services/transbordo.service';
import { Atendimento } from '../../core/models/dashboard.model';
import { ConversaPainelComponent } from './conversa-painel.component';

@Component({
  selector: 'app-atendimentos',
  standalone: true,
  imports: [IconComponent, CommonModule, ConversaPainelComponent],
  templateUrl: './atendimentos.component.html',
  styleUrls: ['../../shared/ui/page-actions.css', './atendimentos.component.css'],
})
export class AtendimentosComponent implements OnInit {
  api = inject(ApiService);
  private destroyRef = inject(DestroyRef);
  private auth = inject(AuthService);
  /** Editar: responder, saudar, pausar o bot e dispensar avisos. Excluir: alertas e conversas. */
  podeEditar = computed(() => this.auth.pode('atendimentos', 'editar'));
  podeExcluir = computed(() => this.auth.pode('atendimentos', 'excluir'));
  private rota = inject(ActivatedRoute);
  private router = inject(Router);
  atendimentos = signal<Atendimento[]>([]);
  transbordo = inject(TransbordoService);
  statusConversas = this.transbordo.conversas;
  filtroTransbordo = signal<boolean | undefined>(undefined);
  modoVisao = signal<'cards' | 'lista'>('cards');
  conversaAberta = signal<string | null>(null);

  abrirConversa(telefone: string) {
    this.conversaAberta.set(telefone);
  }

  fecharConversa() {
    this.conversaAberta.set(null);
    // Tira ?conversa= do endereço para o mesmo link dos avisos poder abrir de novo.
    if (this.rota.snapshot.queryParamMap.has('conversa'))
      this.router.navigate([], { relativeTo: this.rota, queryParams: {} });
    // Se a equipe respondeu pelo painel, o cliente sai do aviso de sem resposta.
    this.carregarSemResposta();
  }

  enviandoContato = signal(new Set<number>());
  contatosEnviados = signal(new Set<number>());
  errosContato = signal<Record<number, string>>({});
  falarComCliente(s: { id: number }) {
    if (this.enviandoContato().has(s.id)) return;
    this.enviandoContato.update((ids) => new Set([...ids, s.id]));
    this.api
      .iniciarContatoTransbordo(s.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.transbordo.assumir(s.id);
          this.contatosEnviados.update((ids) => new Set([...ids, s.id]));
          this.enviandoContato.update((ids) => new Set([...ids].filter((id) => id !== s.id)));
        },
        error: () => {
          this.errosContato.update((erros) => ({
            ...erros,
            [s.id]: 'Não foi possível enviar. Tente novamente.',
          }));
          this.enviandoContato.update((ids) => new Set([...ids].filter((id) => id !== s.id)));
        },
      });
  }
  /** Clientes que escreveram com o bot fora do ar e não foram respondidos; some ao responder ou dispensar. */
  semResposta = signal<ClienteSemResposta[]>([]);
  dispensando = signal(new Set<string>());
  private carregarSemResposta() {
    this.api
      .getClientesSemResposta()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((lista) => this.semResposta.set(lista));
  }
  dispensarSemResposta(telefone: string) {
    if (this.dispensando().has(telefone)) return;
    this.dispensando.update((tels) => new Set([...tels, telefone]));
    this.api
      .dispensarSemResposta(telefone)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.semResposta.update((lista) => lista.filter((c) => c.telefone !== telefone));
          this.dispensando.update((tels) => new Set([...tels].filter((t) => t !== telefone)));
        },
        error: () =>
          this.dispensando.update((tels) => new Set([...tels].filter((t) => t !== telefone))),
      });
  }

  /** Conversa aguardando a decisão no modal de exclusão. */
  conversaParaExcluir = signal<{ id: number; telefone: string; status_atual: string } | null>(null);
  excluindo = signal(false);
  erroExclusao = signal('');
  pedirExclusao(s: { id: number; telefone: string; status_atual: string }) {
    this.erroExclusao.set('');
    this.conversaParaExcluir.set(s);
  }
  cancelarExclusao() {
    if (!this.excluindo()) this.conversaParaExcluir.set(null);
  }
  confirmarExclusao() {
    const s = this.conversaParaExcluir();
    if (!s || this.excluindo()) return;
    this.excluindo.set(true);
    this.erroExclusao.set('');
    this.api
      .excluirConversa(s.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.transbordo.remover(s.id);
          this.excluindo.set(false);
          this.conversaParaExcluir.set(null);
        },
        error: () => {
          this.erroExclusao.set('Não foi possível excluir. Tente novamente.');
          this.excluindo.set(false);
        },
      });
  }
  transbordos = this.transbordo.fila;
  conversasVisiveis = computed(() =>
    this.filtroTransbordo() === true
      ? this.statusConversas().filter((s) => s.status_atual === 'transbordo_humano')
      : this.statusConversas(),
  );

  periodos = [
    { horas: 24, rotulo: 'Últimas 24 horas', texto: 'nas últimas 24 horas' },
    { horas: 168, rotulo: 'Últimos 7 dias', texto: 'nos últimos 7 dias' },
    { horas: 720, rotulo: 'Últimos 30 dias', texto: 'nos últimos 30 dias' },
  ];
  periodoHoras = this.transbordo.periodoHoras;
  textoPeriodo = computed(
    () => this.periodos.find((p) => p.horas === this.periodoHoras())?.texto ?? '',
  );

  ngOnInit() {
    this.carregar();
    this.transbordo.iniciar();
    // Link dos avisos do topo: /atendimentos?conversa=<telefone> abre a conversa desse cliente.
    this.rota.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((parametros) => {
      const telefone = parametros.get('conversa');
      if (telefone && /^\d{10,15}$/.test(telefone)) this.abrirConversa(telefone);
    });
    const timer = setInterval(() => this.carregarSemResposta(), 30000);
    this.destroyRef.onDestroy(() => clearInterval(timer));
    // Fora desta tela o monitor volta ao padrão leve (24 h) usado pelo cabeçalho.
    this.destroyRef.onDestroy(() => this.transbordo.mudarPeriodo(24));
  }

  mudarPeriodo(horas: number) {
    this.transbordo.mudarPeriodo(horas);
  }

  carregar() {
    this.carregarSemResposta();
    this.api
      .getStatusConversas(this.periodoHoras())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => {
        this.statusConversas.set(res);
      });
    this.api.getAtendimentos(this.filtroTransbordo()).subscribe((res) => {
      this.atendimentos.set(res.data);
    });
  }

  alternarVisao(modo: 'cards' | 'lista') {
    this.modoVisao.set(modo);
  }

  filtrar(transbordo?: boolean) {
    this.filtroTransbordo.set(transbordo);
    this.carregar();
  }

  temItensRascunho(rascunho: any): boolean {
    if (!rascunho) return false;
    return !!(
      rascunho.pratos?.length ||
      rascunho.bebidas?.length ||
      rascunho.endereco ||
      rascunho.formaPagamento
    );
  }

  formatStatusConversa(status: string): string {
    const map: Record<string, string> = {
      conversa_iniciada: 'Iniciada / Menu',
      fazendo_pedido_pratos: 'Escolhendo Pratos',
      fazendo_pedido_bebidas: 'Escolhendo Bebidas',
      coletando_endereco: 'Coletando Endereço',
      coletando_pagamento: 'Definindo Pagamento',
      preparando_na_cozinha: 'Na Cozinha',
      saiu_para_entrega: 'Saiu p/ Entrega',
      cancelado_apos_30_minutos: 'Cancelado (30 min)',
      transbordo_humano: 'Transbordo Humano',
    };
    return map[status] || status;
  }

  getBadgeClass(status: string): string {
    const map: Record<string, string> = {
      conversa_iniciada: 'badge-pending',
      fazendo_pedido_pratos: 'badge-prep',
      fazendo_pedido_bebidas: 'badge-prep',
      coletando_endereco: 'badge-prep',
      coletando_pagamento: 'badge-prep',
      preparando_na_cozinha: 'badge-delivered',
      saiu_para_entrega: 'badge-delivery',
      cancelado_apos_30_minutos: 'badge-canceled',
      transbordo_humano: 'badge-canceled',
    };
    return map[status] || 'badge-pending';
  }
}
