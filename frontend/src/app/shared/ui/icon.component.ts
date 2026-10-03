import { Component, Input } from '@angular/core';
@Component({selector:'app-icon',standalone:true,template:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path [attr.d]="paths[nome] || paths['dashboard']" /></svg>`,styles:[`:host{display:inline-flex;align-items:center;justify-content:center;vertical-align:middle}`]})
export class IconComponent {
 @Input() nome='dashboard';
 paths:Record<string,string>={dashboard:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',pedidos:'M6 4h12v17H6z M9 2h6v4H9z M9 10h6 M9 14h6 M9 18h3',atendimentos:'M21 11a8 8 0 0 1-8 8H7l-4 3v-7a8 8 0 1 1 18-4 M7 10h10 M7 14h6',clientes:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M17 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87',cardapio:'M4 3h6a2 2 0 0 1 2 2v16a3 3 0 0 0-3-2H4z M20 3h-6a2 2 0 0 0-2 2v16a3 3 0 0 1 3-2h5z',configuracoes:'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0'};
}
