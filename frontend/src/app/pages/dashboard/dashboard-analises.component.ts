import { Component, Input, OnChanges, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { AnalisesDashboard } from '../../core/models/dashboard.model';
@Component({selector: 'app-dashboard-analises', standalone: true, imports: [CommonModule], template: `
 @if (erro()) { <p role="alert">{{ erro() }} <button class="btn btn-secondary" (click)="carregar()">Tentar novamente</button></p> }
 @if (dados(); as a) {
 <section class="glass-card demanda"><h3>Pedidos por dia da semana e hora</h3><p>Últimos {{ dias }} dias · São Paulo · contorno indica a agenda atual. {{ a.pedidos_fora_agenda }} pedidos fora dessa agenda.</p>
 <div class="scroll"><table><caption class="sr-only">Quantidade de pedidos por hora e dia</caption><thead><tr><th>Dia / hora</th>@for(h of horas; track h){<th>{{h}}h</th>}</tr></thead><tbody>
 @for(d of a.demanda; track d.dia){<tr><th>{{ semana[d.dia-1] }}</th>@for(c of d.horas; track c.hora){<td [class.aberto]="c.atendimento" [style.background]="cor(c.pedidos)" [title]="semana[d.dia-1] + ' ' + c.hora + 'h: ' + c.pedidos + ' pedidos'">{{c.pedidos || '·'}}</td>}</tr>}
 </tbody></table></div></section>
 <div class="grid">
 <section class="glass-card"><h3>Tempo de preparo e entrega</h3><p>Apenas intervalos concluídos com horários válidos. Preparo começa ao entrar na cozinha.</p>
 @for(t of a.tempos; track t.tipo){<div class="linha"><span>{{ nomes[t.tipo] }}</span><strong>{{ t.minutos === null ? 'Sem dados' : t.minutos + ' min' }}</strong></div><meter min="0" [max]="maxTempo()" [value]="t.minutos ?? 0" [attr.aria-label]="nomes[t.tipo]"></meter><small>{{ t.amostras }} intervalos medidos</small>}
 </section>
 <section class="glass-card"><h3>Conversão dos atendimentos</h3><p>Pedidos / todos os {{ a.atendimentos.total }} atendimentos iniciados no período.</p><strong class="numero">{{ a.atendimentos.conversao === null ? 'Sem dados' : a.atendimentos.conversao + '%' }}</strong>
 @for(s of a.atendimentos.status; track s.nome){<div class="linha"><span>{{ nomes[s.nome] || s.nome }}</span><strong>{{s.total}}</strong></div><meter min="0" [max]="a.atendimentos.total || 1" [value]="s.total" [attr.aria-label]="nomes[s.nome] || s.nome"></meter>}
 </section>
 <section class="glass-card"><h3>Abandono por etapa</h3><p>Registros antigos sem etapa aparecem como não registrados.</p>
 @for(s of a.atendimentos.abandonos; track s.nome){<div class="linha"><span>{{ nomes[s.nome] || s.nome }}</span><strong>{{s.total}}</strong></div><meter min="0" [max]="a.atendimentos.total || 1" [value]="s.total" [attr.aria-label]="s.nome"></meter>} @empty {<p>Nenhum abandono no período.</p>}
 </section>
 <section class="glass-card"><h3>Cancelamentos por motivo</h3><p>Cancelamentos excluídos do faturamento e do ticket médio.</p>
 @for(s of a.cancelamentos; track s.nome){<div class="linha"><span>{{s.nome}}</span><strong>{{s.total}}</strong></div><meter min="0" [max]="maxCancelamentos()" [value]="s.total" [attr.aria-label]="s.nome"></meter>} @empty {<p>Nenhum cancelamento no período.</p>}
 </section></div>
 } @else {<p role="status">{{ erro() ? 'Indicadores indisponíveis.' : 'Carregando indicadores…' }}</p>}
 `, styles: [`:host{display:block}section{padding:22px;min-width:0}h3{font-size:1.05rem}p,small{color:var(--text-muted);font-size:.8rem;margin:8px 0 16px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;margin-top:20px}.scroll{overflow-x:auto}table{width:100%;border-collapse:separate;border-spacing:4px;font-size:.72rem}th{white-space:nowrap}td{min-width:26px;text-align:center;border-radius:4px;height:28px;color:#fff}.aberto{outline:1px solid #94a3b8}.linha{display:flex;justify-content:space-between;gap:12px;margin-top:14px}meter{width:100%;height:12px;accent-color:#f59e0b}.numero{font-size:2rem;color:#fbbf24}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}@media(max-width:800px){.grid{grid-template-columns:1fr}}`]
})
export class DashboardAnalisesComponent implements OnChanges, OnDestroy {
 @Input() dias = 7; @Input() atualizacao = 0;
 private api = inject(ApiService); private requisicao?: Subscription;
 dados = signal<AnalisesDashboard | null>(null); erro = signal<string | null>(null);
 horas = Array.from({length:24},(_,i)=>i); semana=['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
 nomes: Record<string,string> = {preparo:'Preparo',entrega:'Entrega',total:'Pedido até entrega',em_andamento:'Em andamento',finalizado_com_pedido:'Com pedido',finalizado_sem_pedido:'Sem pedido',abandonado:'Abandonados',transbordo_humano:'Atendimento humano',conversa_iniciada:'Início',fazendo_pedido_pratos:'Escolha dos pratos',fazendo_pedido_bebidas:'Bebidas',coletando_endereco:'Endereço',coletando_pagamento:'Pagamento'};
 ngOnChanges(){this.carregar();} ngOnDestroy(){this.requisicao?.unsubscribe();}
 carregar(){this.requisicao?.unsubscribe();this.erro.set(null);this.dados.set(null);this.requisicao=this.api.getAnalises(this.dias).subscribe({next:a=>this.dados.set(a),error:()=>this.erro.set('Não foi possível carregar os indicadores. Verifique a API.')});}
 maxTempo(){return Math.max(1,...(this.dados()?.tempos.map(t=>t.minutos??0)??[]));}
 maxCancelamentos(){return Math.max(1,...(this.dados()?.cancelamentos.map(s=>s.total)??[]));}
 cor(q:number){const max=Math.max(1,...(this.dados()?.demanda.flatMap(d=>d.horas.map(h=>h.pedidos))??[]));return q ? 'rgba(245,158,11,'+(0.2+q/max*0.65)+')':'rgba(255,255,255,.04)';}
}
