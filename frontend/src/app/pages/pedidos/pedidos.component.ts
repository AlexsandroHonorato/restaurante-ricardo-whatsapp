import { IconComponent } from '../../shared/ui/icon.component';
import { PedidoStatusComponent } from '../../shared/ui/pedido-status.component';
import { Component, OnInit, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { Pedido } from '../../core/models/dashboard.model';

@Component({
  selector: 'app-pedidos',
  standalone: true,
  imports: [IconComponent, CommonModule, FormsModule, PedidoStatusComponent],
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
  pedidos = signal<Pedido[]>([]);
  filtroStatus = signal<string>('');
  modoVisao = signal<'cards' | 'lista'>('cards');
  termoBusca: string = '';
  toastMensagem = signal<string | null>(null);
  despachandoIds = signal<Record<number, boolean>>({});

  ngOnInit() {
    this.carregarPedidos();
  }

  alternarVisao(modo: 'cards' | 'lista') {
    this.modoVisao.set(modo);
  }

  carregarPedidos() {
    this.api.getPedidos(this.filtroStatus(), this.termoBusca).subscribe((res) => {
      this.pedidos.set(res.data);
    });
  }

  filtrarStatus(status: string) {
    this.filtroStatus.set(status);
    this.carregarPedidos();
  }

  buscar() {
    this.carregarPedidos();
  }

  alterarStatus(pedido: Pedido, novoStatus: string) {
    this.api.updatePedidoStatus(pedido.id, novoStatus).subscribe(() => {
      this.carregarPedidos();
      this.api.getKpis().subscribe();
    });
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
      error: () => {
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
