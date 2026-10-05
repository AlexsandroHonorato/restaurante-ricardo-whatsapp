import { Component, input, output } from '@angular/core';

/** Navegação entre páginas de uma lista paginada pela API (some quando há uma página só). */
@Component({
  selector: 'app-paginacao',
  template: `
    @if (ultima() > 1) {
      <nav class="paginacao" aria-label="Paginação">
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          [disabled]="pagina() <= 1"
          (click)="mudar.emit(pagina() - 1)"
        >
          ‹ Anterior
        </button>
        <span aria-live="polite"
          >Página {{ pagina() }} de {{ ultima() }} · {{ total() }} no total</span
        >
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          [disabled]="pagina() >= ultima()"
          (click)="mudar.emit(pagina() + 1)"
        >
          Próxima ›
        </button>
      </nav>
    }
  `,
  styles: `
    .paginacao {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 16px;
      color: var(--text-muted);
      font-size: 0.85rem;
    }
  `,
})
export class PaginacaoComponent {
  pagina = input.required<number>();
  ultima = input.required<number>();
  total = input.required<number>();
  mudar = output<number>();
}
