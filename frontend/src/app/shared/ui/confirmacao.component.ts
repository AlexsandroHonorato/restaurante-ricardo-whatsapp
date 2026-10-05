import { Component, ElementRef, afterRenderEffect, inject, viewChild } from '@angular/core';
import { ConfirmacaoService } from './confirmacao.service';
import { IconComponent } from './icon.component';

/**
 * Janela do modal de decisão (uma só, no layout). Usa <dialog> nativo para ficar por cima de qualquer
 * outro modal aberto (formulário do cardápio, painel de notificações) e prender o foco.
 */
@Component({
  selector: 'app-confirmacao',
  imports: [IconComponent],
  template: `
    <dialog
      #dialog
      class="confirmacao"
      aria-labelledby="confirmacao-titulo"
      aria-describedby="confirmacao-mensagem"
      (cancel)="$event.preventDefault(); confirmacao.responder(false)"
      (click)="$event.target === dialog && confirmacao.responder(false)"
    >
      @if (confirmacao.pendente(); as p) {
        <div class="corpo">
          <span class="simbolo" [class.perigo]="p.perigo" aria-hidden="true">
            <app-icon [nome]="p.perigo ? 'alerta' : 'confirmar'" />
          </span>
          <h2 id="confirmacao-titulo">{{ p.titulo }}</h2>
          <p id="confirmacao-mensagem">{{ p.mensagem }}</p>
          <div class="acoes">
            <button
              type="button"
              class="btn btn-secondary cancelar"
              autofocus
              (click)="confirmacao.responder(false)"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="btn btn-primary confirmar"
              [class.perigo]="p.perigo"
              (click)="confirmacao.responder(true)"
            >
              {{ p.confirmar }}
            </button>
          </div>
        </div>
      }
    </dialog>
  `,
  styles: `
    /* Mesmo padrão do modal de cancelamento de pedido: centralizado na tela, só com tokens do design system. */
    .confirmacao {
      position: fixed;
      inset: 0;
      margin: auto;
      width: min(440px, calc(100vw - var(--ds-space-8)));
      max-height: calc(100dvh - var(--ds-space-8));
      padding: 0;
      border: 1px solid var(--border-highlight);
      border-radius: var(--radius-lg);
      background: var(--bg-surface);
      color: var(--text-primary);
      font-family: var(--font-body);
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
      overflow-y: auto;
    }
    .confirmacao::backdrop {
      background: rgba(9, 13, 24, 0.75);
      backdrop-filter: blur(4px);
    }
    .confirmacao[open] {
      animation: confirmacao-entrar var(--transition-normal);
    }
    @keyframes confirmacao-entrar {
      from {
        opacity: 0;
        transform: translateY(var(--ds-space-2)) scale(0.98);
      }
    }
    .corpo {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--ds-space-3);
      padding: var(--ds-space-8) var(--ds-space-6) var(--ds-space-6);
      text-align: center;
    }
    .simbolo {
      display: grid;
      place-items: center;
      width: 48px;
      height: 48px;
      margin-bottom: var(--ds-space-1);
      border-radius: var(--radius-md);
      background: var(--primary-glow);
      color: var(--primary-text);
    }
    .simbolo.perigo {
      background: var(--danger-glow);
      color: var(--danger);
    }
    h2 {
      margin: 0;
      font-family: var(--font-heading);
      font-size: 1.15rem;
    }
    p {
      margin: 0;
      font-size: 0.875rem;
      line-height: 1.5;
      color: var(--text-secondary);
      overflow-wrap: anywhere;
    }
    .acoes {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: var(--ds-space-3);
      width: 100%;
      margin-top: var(--ds-space-3);
    }
    .acoes .btn {
      flex: 1 1 140px;
      justify-content: center;
    }
    .confirmar.perigo {
      background: var(--danger);
      border-color: var(--danger);
      color: var(--ds-background);
    }
    button:focus-visible {
      outline: 2px solid var(--primary-text);
      outline-offset: 3px;
    }
    @media (prefers-reduced-motion: reduce) {
      .confirmacao[open] {
        animation: none;
      }
    }
  `,
})
export class ConfirmacaoComponent {
  confirmacao = inject(ConfirmacaoService);
  private dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    afterRenderEffect(() => {
      const aberto = !!this.confirmacao.pendente();
      const dialog = this.dialog().nativeElement;
      if (aberto && !dialog.open) dialog.showModal();
      if (!aberto && dialog.open) dialog.close();
    });
  }
}
