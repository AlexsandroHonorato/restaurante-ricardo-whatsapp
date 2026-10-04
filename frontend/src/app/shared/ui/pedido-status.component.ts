import { Component, Input } from '@angular/core';
import { STATUS_PEDIDO } from './pedido-status';
@Component({
  selector: 'app-pedido-status',
  standalone: true,
  template: `<span [class]="'badge ' + (dados.classe || '')"
    ><span aria-hidden="true">{{ dados.icone }}</span
    >{{ dados.nome }}</span
  >`,
})
export class PedidoStatusComponent {
  @Input({ required: true }) status = '';
  get dados() {
    return STATUS_PEDIDO[this.status] || { nome: this.status, classe: '', icone: '•' };
  }
}
