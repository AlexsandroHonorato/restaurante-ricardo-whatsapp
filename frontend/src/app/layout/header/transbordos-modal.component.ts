import { Component, ElementRef, ViewChild, DestroyRef, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TransbordoService } from '../../core/services/transbordo.service';
import { ApiService } from '../../core/services/api.service';
import { IconComponent } from '../../shared/ui/icon.component';

@Component({
  selector: 'app-transbordos-modal',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  template: `
    <dialog #dialog class="transbordos-dialog" aria-labelledby="transbordos-titulo" aria-describedby="transbordos-descricao" (click)="fecharFundo($event)">
      <div class="modal-heading">
        <div><h2 id="transbordos-titulo"><app-icon nome="alerta"/> Notificações <span class="notification-total">{{ transbordo.aguardando() }} pendentes</span></h2>
          <p id="transbordos-descricao">{{ transbordo.aguardando() }} cliente(s) aguardando · Mais antigos primeiro</p>
        </div>
        <button type="button" class="close" autofocus aria-label="Fechar lista de transbordos" (click)="fechar()"><app-icon nome="fechar"/></button>
      </div>
      <div class="modal-list">
        @for (s of transbordo.fila(); track s.id; let i = $index) {
          <article class="pending-item">
            <span class="queue-number">{{ i + 1 }}</span>
            <div class="pending-info"><strong>Cliente solicita atendimento</strong>
              <span class="customer-phone"><app-icon nome="clientes"/> WhatsApp {{ s.telefone }}</span>
              <span class="notification-type">TRANSBORDO HUMANO · {{ i + 1 }}º na fila</span>
              @if (s.rascunho?.pratos?.length) { <small>Pratos: {{ s.rascunho.pratos.join(', ') }}</small> }
              @if (s.rascunho?.bebidas?.length) { <small>Bebidas: {{ s.rascunho.bebidas.join(', ') }}</small> }
              @if (s.rascunho?.endereco) { <small>Endereço: {{ s.rascunho.endereco }}</small> }
              @if (s.rascunho?.formaPagamento) { <small>Pagamento: {{ s.rascunho.formaPagamento }}</small> }
              <small>Último contato: {{ s.ultimo_contato_em | date:'dd/MM HH:mm' }}</small>
            </div>
            <button type="button" class="btn btn-primary btn-sm" [disabled]="enviando().has(s.id)" (click)="falar(s.id)">
              <app-icon nome="atendimentos"/> {{ enviando().has(s.id) ? 'Enviando…' : 'Falar com o cliente' }}
            </button>
            @if (erros()[s.id]) { <p class="send-error" role="alert">{{ erros()[s.id] }}</p> }
          </article>
        } @empty {
          <div class="empty"><app-icon nome="confirmar"/><strong>Nenhum transbordo pendente</strong><p>Novas solicitações aparecerão aqui automaticamente.</p></div>
        }
      </div>
      @if (ultimoContato()) {
        <p class="success" role="status">Mensagem inicial enviada.
          <a [href]="'https://wa.me/' + ultimoContato()" target="_blank" rel="noopener noreferrer">Abrir conversa no WhatsApp</a>
        </p>
      }
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" (click)="fechar()">Fechar</button>
        <a class="btn btn-primary" routerLink="/atendimentos" (click)="fechar()">Ver monitor de atendimentos</a>
      </div>
    </dialog>
  `,
  styles: [`
    .transbordos-dialog{position:fixed;margin:0;width:min(390px,calc(100vw - 32px));max-height:calc(100dvh - 32px);padding:0;border:1px solid var(--border-color);border-radius:18px;background:var(--bg-surface);color:var(--text-primary);box-shadow:0 24px 80px rgba(0,0,0,.5)}
    .transbordos-dialog[open]{display:flex;flex-direction:column}.transbordos-dialog::backdrop{background:transparent}
    .modal-heading{display:flex;justify-content:space-between;gap:10px;padding:16px;border-bottom:1px solid var(--border-color)}
    h2{display:flex;align-items:center;gap:10px;margin:0;font-size:.95rem}h2 app-icon{color:var(--primary-text)}
    .modal-heading p{margin:8px 0 0;font-size:.82rem;color:var(--text-muted)}
    .close{width:34px;height:34px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border:1px solid var(--border-color);border-radius:9px;background:var(--bg-surface-elevated);color:var(--text-secondary);cursor:pointer}
    .modal-list{padding:12px 14px;min-height:0;max-height:58dvh;overflow-y:auto;display:grid;gap:12px}
    .pending-item{display:flex;align-items:center;flex-wrap:wrap;gap:12px;padding:16px;border:1px solid rgba(var(--primary-rgb),.5);border-radius:12px;background:var(--primary-glow)}
    .notification-total{font-size:.65rem;padding:3px 6px;border-radius:8px;white-space:nowrap;background:var(--primary-glow);color:var(--primary-text)}
    .pending-item .btn{width:100%;justify-content:center}
    .customer-phone{display:flex;align-items:center;gap:6px}
    .pending-info .notification-type{color:var(--primary-text);font-size:.68rem;font-weight:600}
    .pending-info small:last-child{padding-top:8px;margin-top:4px;border-top:1px solid var(--border-color)}
    .queue-number{display:grid;place-items:center;width:30px;height:30px;border-radius:8px;background:var(--primary-glow);color:var(--primary-text);font-weight:700;flex-shrink:0}
    .pending-info{flex:1;min-width:150px;display:flex;flex-direction:column;gap:5px;overflow-wrap:anywhere}.pending-info strong{font-size:.9rem}.pending-info span,.pending-info small{font-size:.78rem;color:var(--text-muted)}
    .send-error{width:100%;margin:0;color:var(--danger);font-size:.8rem}
    .empty{display:flex;flex-direction:column;align-items:center;padding:32px 10px;gap:12px;text-align:center}.empty app-icon{color:var(--success)}.empty p{margin:0;color:var(--text-muted);font-size:.85rem}
    .success{margin:0;padding:12px 24px;color:var(--success);font-size:.85rem}.success a{color:var(--primary-text);margin-left:6px}
    .modal-footer{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:10px;padding:14px;border-top:1px solid var(--border-color)}
    button:focus-visible,a:focus-visible{outline:2px solid var(--primary-text);outline-offset:3px}
    @media(max-width:560px){.modal-heading,.modal-list,.modal-footer{padding:16px}.pending-item .btn{width:100%}}
  `]
})
export class TransbordosModalComponent {
  @ViewChild('dialog') dialog!: ElementRef<HTMLDialogElement>;
  transbordo = inject(TransbordoService);
  private api = inject(ApiService);
  private destroyRef = inject(DestroyRef);
  enviando = signal(new Set<number>());
  erros = signal<Record<number,string>>({});
  ultimoContato = signal<string | null>(null);
  private ancora: HTMLElement | null = null;
  abrir(alvo?: EventTarget | null) {
    if (this.dialog.nativeElement.open) { this.fechar(); return; }
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
    const esquerda = Math.max(16, Math.min((rect?.right ?? window.innerWidth - 16) - largura, window.innerWidth - largura - 16));
    const topo = Math.max(16, Math.min((rect?.bottom ?? 64) + 12, window.innerHeight - 180));
    dialog.style.left = esquerda + 'px';
    dialog.style.top = topo + 'px';
    dialog.style.maxHeight = (window.innerHeight - topo - 16) + 'px';
  }
  fechar() { this.dialog.nativeElement.close(); }
  fecharFundo(evento: MouseEvent) { if (evento.target === this.dialog.nativeElement) { const r = this.dialog.nativeElement.getBoundingClientRect(); if (evento.clientX < r.left || evento.clientX > r.right || evento.clientY < r.top || evento.clientY > r.bottom) this.fechar(); } }
  falar(id: number) {
    if (this.enviando().has(id)) return;
    const cliente = this.transbordo.fila().find(s => s.id === id);
    if (!cliente) return;
    this.enviando.update(ids => new Set([...ids,id]));
    this.erros.update(erros => ({...erros,[id]:''}));
    this.api.iniciarContatoTransbordo(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.ultimoContato.set(cliente.telefone);
        this.transbordo.assumir(id);
        this.enviando.update(ids => new Set([...ids].filter(x => x !== id)));
      },
      error: () => {
        this.erros.update(erros => ({...erros,[id]:'Não foi possível enviar a saudação. Tente novamente.'}));
        this.enviando.update(ids => new Set([...ids].filter(x => x !== id)));
      }
    });
  }
}

