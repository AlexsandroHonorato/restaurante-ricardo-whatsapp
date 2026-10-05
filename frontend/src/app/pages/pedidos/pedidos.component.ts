import { IconComponent } from '../../shared/ui/icon.component';
import { PedidoStatusComponent } from '../../shared/ui/pedido-status.component';
import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatDatepickerModule, MatDatepickerIntl } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { provideNativeDateAdapter, MAT_DATE_LOCALE, DateAdapter } from '@angular/material/core';
import { DataBrasileiraAdapter, calendarioPortugues } from '../../core/date-adapter';
import { ApiService, PeriodoDashboard } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmacaoService } from '../../shared/ui/confirmacao.service';
import { Pedido } from '../../core/models/dashboard.model';
import { ComandaService } from '../../core/services/comanda.service';
import { PaginacaoComponent } from '../../shared/ui/paginacao.component';
import { Subscription, finalize } from 'rxjs';

@Component({
  selector: 'app-pedidos',
  standalone: true,
  imports: [
    IconComponent,
    CommonModule,
    FormsModule,
    PedidoStatusComponent,
    PaginacaoComponent,
    ReactiveFormsModule,
    MatDatepickerModule,
    MatFormFieldModule,
  ],
  // Calendário em português com datas DD/MM/AAAA, igual ao do Dashboard.
  providers: [
    provideNativeDateAdapter(),
    { provide: DateAdapter, useClass: DataBrasileiraAdapter },
    { provide: MatDatepickerIntl, useFactory: calendarioPortugues },
    { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' },
  ],
  templateUrl: './pedidos.component.html',
  styleUrls: ['../../shared/ui/page-actions.css', './pedidos.component.css'],
})
export class PedidosComponent implements OnInit {
  cancelando = signal<Pedido | null>(null);
  motivoCancelamento = '';
  salvandoCancelamento = signal(false);
  erroCancelamento = signal<string | null>(null);
  @ViewChild('cancelamentoDialog') cancelamentoDialog!: ElementRef<HTMLDialogElement>;
  abrirCancelamento(pedido: Pedido) {
    this.cancelando.set(pedido);
    this.motivoCancelamento = '';
    this.erroCancelamento.set(null);
    this.cancelamentoDialog.nativeElement.showModal();
    this.cancelamentoDialog.nativeElement.querySelector('textarea')?.focus();
  }
  fecharCancelamento() {
    if (this.salvandoCancelamento()) return;
    this.cancelamentoDialog.nativeElement.close();
    this.cancelando.set(null);
  }
  aoCancelarDialog(event: Event) {
    if (this.salvandoCancelamento()) {
      event.preventDefault();
      return;
    }
    this.cancelando.set(null);
  }

  confirmarCancelamento() {
    const pedido = this.cancelando();
    const motivo = this.motivoCancelamento.trim();
    if (!pedido || !motivo || this.salvandoCancelamento()) return;
    this.salvandoCancelamento.set(true);
    this.api.updatePedidoStatus(pedido.id, 'cancelado', motivo).subscribe({
      next: () => {
        this.salvandoCancelamento.set(false);
        this.fecharCancelamento();
        this.carregarPedidos();
        this.api.getKpis().subscribe();
      },
      error: () => {
        this.salvandoCancelamento.set(false);
        this.erroCancelamento.set('Não foi possível cancelar. Tente novamente.');
      },
    });
  }

  api = inject(ApiService);
  /** Perfil sem "editar" em Pedidos só acompanha: sem mudar status, cancelar nem imprimir comanda. */
  private auth = inject(AuthService);
  podeEditar = computed(() => this.auth.pode('pedidos', 'editar'));
  podeExcluir = computed(() => this.auth.pode('pedidos', 'excluir'));
  private confirmacao = inject(ConfirmacaoService);
  excluindoIds = signal(new Set<number>());

  /** Exclusão definitiva: o pedido sai do faturamento e dos totais do cliente. */
  excluirPedido(pedido: Pedido) {
    if (this.excluindoIds().has(pedido.id)) return;
    this.confirmacao.pedir(
      {
        titulo: 'Excluir pedido?',
        mensagem: `O pedido ${pedido.codigo_pedido} será apagado definitivamente, com itens e histórico, e deixa de contar no faturamento. Para manter o registro, use Cancelar.`,
        confirmar: 'Excluir pedido',
        perigo: true,
      },
      () => {
        this.excluindoIds.update((ids) => new Set([...ids, pedido.id]));
        this.erroAcao.set(null);
        this.api
          .excluirPedido(pedido.id)
          .pipe(
            finalize(() =>
              this.excluindoIds.update((ids) => new Set([...ids].filter((id) => id !== pedido.id))),
            ),
          )
          .subscribe({
            next: () => {
              this.toastMensagem.set(`Pedido ${pedido.codigo_pedido} excluído.`);
              setTimeout(() => this.toastMensagem.set(null), 4500);
              this.carregarPedidos();
            },
            error: (erro) =>
              this.erroAcao.set(
                `Pedido ${pedido.codigo_pedido}: ${erro?.error?.message || 'não foi possível excluir. Tente novamente.'}`,
              ),
          });
      },
    );
  }
  pedidos = signal<Pedido[]>([]);
  filtroStatus = signal<string>('');
  modoVisao = signal<'cards' | 'lista'>('cards');
  termoBusca: string = '';
  toastMensagem = signal<string | null>(null);
  despachandoIds = signal<Record<number, boolean>>({});

  comanda = inject(ComandaService);
  impressaoAutomatica = signal(this.comanda.automatica);
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    this.carregarPedidos();
    // Com a impressão automática ligada neste aparelho, novos pedidos saem na impressora da cozinha.
    const timer = setInterval(() => {
      if (this.impressaoAutomatica()) this.comanda.imprimirPendentes();
    }, 15000);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  alternarImpressaoAutomatica() {
    const ligada = !this.impressaoAutomatica();
    this.impressaoAutomatica.set(ligada);
    this.comanda.automatica = ligada;
    if (ligada) this.comanda.imprimirPendentes();
  }

  alternarVisao(modo: 'cards' | 'lista') {
    this.modoVisao.set(modo);
  }

  pagina = signal(1);
  ultimaPagina = signal(1);
  totalPedidos = signal(0);
  erroLista = signal<string | null>(null);
  erroAcao = signal<string | null>(null);
  alterandoIds = signal(new Set<number>());
  private consulta?: Subscription;

  carregarPedidos() {
    // Busca digitada rápido: só vale a resposta da consulta mais recente.
    this.consulta?.unsubscribe();
    const periodo = this.periodo();
    this.consulta = (
      periodo
        ? this.api.getPedidos(this.filtroStatus(), this.termoBusca, this.pagina(), periodo)
        : this.api.getPedidos(this.filtroStatus(), this.termoBusca, this.pagina())
    ).subscribe({
      next: (res) => {
        // A página ficou vazia (pedidos mudaram de status): volta para a última que existe.
        if (res.current_page > res.last_page) return this.irParaPagina(res.last_page);
        this.erroLista.set(null);
        this.pedidos.set(res.data);
        this.ultimaPagina.set(res.last_page);
        this.totalPedidos.set(res.total);
      },
      error: () =>
        this.erroLista.set(
          'Não foi possível carregar os pedidos. A lista abaixo pode estar desatualizada.',
        ),
    });
  }

  irParaPagina(pagina: number) {
    this.pagina.set(pagina);
    this.carregarPedidos();
  }

  filtrarStatus(status: string) {
    this.filtroStatus.set(status);
    this.irParaPagina(1);
  }

  buscar() {
    this.irParaPagina(1);
  }

  /** Período personalizado (mesmo campo do Dashboard): sem período, a lista traz todos os pedidos. */
  periodo = signal<PeriodoDashboard | null>(null);
  erroDatas = signal<string | null>(null);
  datas = new FormGroup({
    inicio: new FormControl<Date | null>(null),
    fim: new FormControl<Date | null>(null),
  });
  private dataLocal(data: Date) {
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
  }
  rotuloPeriodo() {
    const p = this.periodo();
    return p
      ? `${p.inicio.split('-').reverse().join('/')} a ${p.fim.split('-').reverse().join('/')}`
      : 'Todos os períodos';
  }
  aplicarDatas() {
    const { inicio, fim } = this.datas.getRawValue();
    this.erroDatas.set(null);
    if (
      this.datas.invalid ||
      !inicio ||
      !fim ||
      !Number.isFinite(inicio.getTime()) ||
      !Number.isFinite(fim.getTime())
    )
      return;
    const dias =
      (Date.UTC(fim.getFullYear(), fim.getMonth(), fim.getDate()) -
        Date.UTC(inicio.getFullYear(), inicio.getMonth(), inicio.getDate())) /
        86400000 +
      1;
    if (dias < 1 || dias > 365) {
      this.erroDatas.set('Selecione um intervalo de 1 a 365 dias.');
      return;
    }
    this.periodo.set({ inicio: this.dataLocal(inicio), fim: this.dataLocal(fim) });
    this.irParaPagina(1);
  }
  limparDatas() {
    this.datas.reset();
    this.erroDatas.set(null);
    if (!this.periodo()) return;
    this.periodo.set(null);
    this.irParaPagina(1);
  }

  alterarStatus(pedido: Pedido, novoStatus: string) {
    if (this.alterandoIds().has(pedido.id)) return;
    this.alterandoIds.update((ids) => new Set([...ids, pedido.id]));
    this.erroAcao.set(null);
    this.api
      .updatePedidoStatus(pedido.id, novoStatus)
      .pipe(
        finalize(() =>
          this.alterandoIds.update((ids) => new Set([...ids].filter((id) => id !== pedido.id))),
        ),
      )
      .subscribe({
        next: () => {
          this.carregarPedidos();
          this.api.getKpis().subscribe();
        },
        error: (erro) => this.mostrarErroAcao(pedido, erro),
      });
  }

  private mostrarErroAcao(pedido: Pedido, erro: { error?: { message?: string } }) {
    this.erroAcao.set(
      `Pedido ${pedido.codigo_pedido}: ${erro?.error?.message || 'não foi possível alterar o status. Tente novamente.'}`,
    );
  }

  despacharParaEntrega(pedido: Pedido) {
    // Trava de Idempotência: Bloqueia se já estiver processando ou se já estiver em rota
    if (this.despachandoIds()[pedido.id] || pedido.status === 'saiu_para_entrega') {
      return;
    }

    // Ativa estado de carregamento do botão imediatamente
    this.despachandoIds.update((m) => ({ ...m, [pedido.id]: true }));

    this.api.updatePedidoStatus(pedido.id, 'saiu_para_entrega').subscribe({
      next: (res) => {
        this.carregarPedidos();
        this.api.getKpis().subscribe();

        const mensagemNotificacao = res.notificacao_enviada
          ? `Pedido ${pedido.codigo_pedido} despachado. Cliente notificado pelo WhatsApp.`
          : `Pedido ${pedido.codigo_pedido} despachado. ${res.erro_notificacao || 'Envio da notificação não confirmado.'}`;
        this.toastMensagem.set(mensagemNotificacao);

        setTimeout(() => {
          this.toastMensagem.set(null);
        }, 6000);
      },
      error: (erro) => {
        this.mostrarErroAcao(pedido, erro);
        // Em caso de falha, libera o botão
        this.despachandoIds.update((m) => {
          const copy = { ...m };
          delete copy[pedido.id];
          return copy;
        });
      },
      complete: () => {
        // Libera a trava após 1.5s
        setTimeout(() => {
          this.despachandoIds.update((m) => {
            const copy = { ...m };
            delete copy[pedido.id];
            return copy;
          });
        }, 1500);
      },
    });
  }
}
