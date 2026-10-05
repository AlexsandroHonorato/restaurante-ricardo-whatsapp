import {
  Component,
  ElementRef,
  ViewChild,
  DestroyRef,
  computed,
  inject,
  signal,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TransbordoService } from '../../core/services/transbordo.service';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { ConfirmacaoService } from '../../shared/ui/confirmacao.service';

@Component({
  selector: 'app-transbordos-modal',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  templateUrl: './transbordos-modal.component.html',
  styleUrl: './transbordos-modal.component.css',
})
export class TransbordosModalComponent {
  @ViewChild('dialog') dialog!: ElementRef<HTMLDialogElement>;
  transbordo = inject(TransbordoService);
  private api = inject(ApiService);
  private confirmacao = inject(ConfirmacaoService);
  private auth = inject(AuthService);
  podeEditar = computed(() => this.auth.pode('atendimentos', 'editar'));
  podeExcluir = computed(() => this.auth.pode('atendimentos', 'excluir'));
  private destroyRef = inject(DestroyRef);
  enviando = signal(new Set<number>());
  erros = signal<Record<number, string>>({});
  ultimoContato = signal<string | null>(null);
  private ancora: HTMLElement | null = null;
  abrir(alvo?: EventTarget | null) {
    if (this.dialog.nativeElement.open) {
      this.fechar();
      return;
    }
    this.ancora = alvo instanceof HTMLElement ? alvo : null;
    this.posicionar();
    this.dialog.nativeElement.showModal();
  }
  @HostListener('window:resize')
  @HostListener('window:scroll')
  posicionar() {
    const dialog = this.dialog?.nativeElement;
    if (!dialog) return;
    const rect = this.ancora?.getBoundingClientRect();
    const largura = Math.min(390, window.innerWidth - 32);
    const esquerda = Math.max(
      16,
      Math.min((rect?.right ?? window.innerWidth - 16) - largura, window.innerWidth - largura - 16),
    );
    const topo = Math.max(16, Math.min((rect?.bottom ?? 64) + 12, window.innerHeight - 180));
    dialog.style.left = esquerda + 'px';
    dialog.style.top = topo + 'px';
    dialog.style.maxHeight = window.innerHeight - topo - 16 + 'px';
  }
  fechar() {
    this.dialog.nativeElement.close();
  }
  fecharFundo(evento: MouseEvent) {
    if (evento.target === this.dialog.nativeElement) {
      const r = this.dialog.nativeElement.getBoundingClientRect();
      if (
        evento.clientX < r.left ||
        evento.clientX > r.right ||
        evento.clientY < r.top ||
        evento.clientY > r.bottom
      )
        this.fechar();
    }
  }
  falar(id: number) {
    if (this.enviando().has(id)) return;
    const cliente = this.transbordo.fila().find((s) => s.id === id);
    if (!cliente) return;
    this.enviando.update((ids) => new Set([...ids, id]));
    this.erros.update((erros) => ({ ...erros, [id]: '' }));
    this.transbordo.ocultar(id);
    this.api
      .iniciarContatoTransbordo(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.ultimoContato.set(cliente.telefone);
          this.transbordo.assumir(id);
          this.transbordo.reexibir(id);
          this.enviando.update((ids) => new Set([...ids].filter((x) => x !== id)));
        },
        error: () => {
          this.transbordo.reexibir(id);
          this.erros.update((erros) => ({
            ...erros,
            [id]: 'Não foi possível enviar a saudação. Tente novamente.',
          }));
          this.enviando.update((ids) => new Set([...ids].filter((x) => x !== id)));
        },
      });
  }
  excluir(id: number) {
    if (this.enviando().has(id)) return;
    const cliente = this.transbordo.fila().find((s) => s.id === id);
    this.confirmacao.pedir(
      {
        titulo: 'Excluir alerta?',
        mensagem: `O aviso de ${cliente?.telefone ?? 'atendimento'} sai da fila para toda a equipe, sem enviar mensagem. A conversa continua no monitor.`,
        confirmar: 'Excluir alerta',
        perigo: true,
      },
      () => this.excluirConfirmado(id),
    );
  }
  private excluirConfirmado(id: number) {
    if (this.enviando().has(id)) return;
    this.enviando.update((ids) => new Set([...ids, id]));
    this.erros.update((erros) => ({ ...erros, [id]: '' }));
    this.api
      .excluirAlertaTransbordo(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.transbordo.assumir(id);
          this.enviando.update((ids) => new Set([...ids].filter((x) => x !== id)));
        },
        error: () => {
          this.erros.update((erros) => ({
            ...erros,
            [id]: 'Não foi possível excluir o alerta. Tente novamente.',
          }));
          this.enviando.update((ids) => new Set([...ids].filter((x) => x !== id)));
        },
      });
  }
}
