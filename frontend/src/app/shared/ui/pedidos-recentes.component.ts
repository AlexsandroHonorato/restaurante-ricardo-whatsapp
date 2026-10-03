import { Component, Input, OnChanges, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { Pedido } from '../../core/models/dashboard.model';
import { PedidoStatusComponent } from './pedido-status.component';
@Component({selector:'app-pedidos-recentes',standalone:true,imports:[CommonModule,RouterModule,PedidoStatusComponent],template:`
 <section class="glass-card recent-orders"><div class="ds-section-heading"><div><h2>Pedidos recentes</h2><p>Últimos pedidos recebidos · todos os status</p></div><a routerLink="/pedidos" class="btn btn-secondary btn-sm">Abrir pedidos ↗</a></div>
 @if(erro()){<p role="alert">{{erro()}} <button class="btn btn-secondary btn-sm" (click)="carregar()">Tentar novamente</button></p>}
 <div class="ds-table-scroll"><table class="ds-table"><caption class="ds-sr-only">Últimos pedidos recebidos</caption><thead><tr><th>Cliente / pedido</th><th>Valor</th><th>Pagamento</th><th>Status</th><th>Recebido em</th><th>Ação</th></tr></thead><tbody>
 @for(p of pedidos();track p.id){<tr><td><strong>{{p.cliente?.nome || 'Cliente não informado'}}</strong><small>{{p.codigo_pedido}}</small></td><td>{{p.valor_total | currency:'BRL':'symbol':'1.2-2':'pt-BR'}}</td><td>{{pagamentos[p.forma_pagamento] || p.forma_pagamento}}</td><td><app-pedido-status [status]="p.status" /></td><td>{{p.created_at | date:'dd/MM HH:mm':'-0300'}}</td><td><a routerLink="/pedidos" class="btn btn-secondary btn-sm" [attr.aria-label]="'Abrir lista de pedidos para gerenciar ' + p.codigo_pedido">Gerenciar</a></td></tr>}
 @empty{<tr><td colspan="6">{{erro()?'Pedidos indisponíveis.':carregando()?'Carregando pedidos…':'Nenhum pedido recebido.'}}</td></tr>}
 </tbody></table></div></section>
 `,styles:[`.recent-orders{padding:24px}.recent-orders h2{font-size:1.1rem}.recent-orders p{font-size:.8rem;color:var(--text-secondary);margin-top:4px}`]})
export class PedidosRecentesComponent implements OnChanges,OnDestroy {
 @Input() atualizacao=0;private api=inject(ApiService);private requisicao?:Subscription;
 pedidos=signal<Pedido[]>([]);erro=signal<string|null>(null);carregando=signal(false);
 pagamentos:Record<string,string>={pix:'Pix',dinheiro:'Dinheiro',cartao_credito:'Crédito',cartao_debito:'Débito',outro:'Outro'};
 ngOnChanges(){this.carregar();}ngOnDestroy(){this.requisicao?.unsubscribe();}
 carregar(){this.requisicao?.unsubscribe();this.carregando.set(true);this.erro.set(null);this.requisicao=this.api.getPedidosRecentes().subscribe({next:r=>{this.pedidos.set(r.data);this.carregando.set(false);},error:()=>{this.erro.set('Não foi possível atualizar os pedidos recentes.');this.carregando.set(false);}});}
}
