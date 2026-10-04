import { Component, Input } from '@angular/core';
@Component({
  selector: 'app-icon',
  standalone: true,
  template: `<svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path [attr.d]="paths[nome] || paths['dashboard']" />
  </svg>`,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        vertical-align: middle;
      }
    `,
  ],
})
export class IconComponent {
  @Input() nome = 'dashboard';
  paths: Record<string, string> = {
    fechar: 'M6 6l12 12 M18 6L6 18',
    pausar: 'M8 5v14 M16 5v14',
    preparo: 'M4 10h16v9H4z M3 10h18 M9 3v4 M15 3v4',
    atualizar: 'M20 7v5h-5 M4 17v-5h5 M6 7a7 7 0 0 1 12-1l2 2 M4 16l2 2a7 7 0 0 0 12-1',
    buscar: 'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0 M15 15l6 6',
    adicionar: 'M12 5v14 M5 12h14',
    editar: 'M4 16l12-12 4 4L8 20H4z M13 7l4 4',
    excluir: 'M3 6h18 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7',
    lista: 'M8 6h13 M8 12h13 M8 18h13 M3 6h1 M3 12h1 M3 18h1',
    alerta: 'M12 3a6 6 0 0 0-6 6v5l-2 3h16l-2-3V9a6 6 0 0 0-6-6 M10 21h4',
    entrega:
      'M3 7h11v11H3z M14 11h4l3 4v3h-7 M8 19a2 2 0 1 1-4 0 2 2 0 0 1 4 0 M20 19a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
    confirmar: 'M5 12l4 4L19 6',
    local: 'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0 M14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
    dashboard: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    pedidos: 'M6 4h12v17H6z M9 2h6v4H9z M9 10h6 M9 14h6 M9 18h3',
    atendimentos: 'M21 11a8 8 0 0 1-8 8H7l-4 3v-7a8 8 0 1 1 18-4 M7 10h10 M7 14h6',
    clientes:
      'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M17 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87',
    cardapio: 'M4 3h6a2 2 0 0 1 2 2v16a3 3 0 0 0-3-2H4z M20 3h-6a2 2 0 0 0-2 2v16a3 3 0 0 1 3-2h5z',
    configuracoes:
      'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  };
}
