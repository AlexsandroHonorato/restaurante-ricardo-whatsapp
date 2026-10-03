import { Component, Input, OnChanges, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { AnalisesDashboard } from '../../core/models/dashboard.model';
@Component({selector: 'app-dashboard-analises', standalone: true, imports: [CommonModule], template: `
 @if (erro()) { <p role="alert">{{ erro() }} <button class="btn btn-secondary" (click)="carregar()">Tentar novamente</button></p> }
 @if (dados(); as a) {
 <section class="glass-card demanda" [attr.aria-busy]="atualizando()"><h3>Pedidos por dia da semana e hora</h3><p>Últimos {{ a.dias }} dias · São Paulo · contorno indica a agenda atual. {{ a.pedidos_fora_agenda }} pedidos fora dessa agenda.</p>
 <div class="scroll"><table><caption class="sr-only">Quantidade de pedidos por hora e dia</caption><thead><tr><th>Dia / hora</th>@for(h of horas; track h){<th>{{h}}h</th>}</tr></thead><tbody>
 @for(d of a.demanda; track d.dia){<tr><th>{{ semana[d.dia-1] }}</th>@for(c of d.horas; track c.hora){<td [class.aberto]="c.atendimento" [style.background]="cor(c.pedidos)" [title]="semana[d.dia-1] + ' ' + c.hora + 'h: ' + c.pedidos + ' pedidos'">{{c.pedidos || '·'}}</td>}</tr>}
 </tbody></table></div></section>
 <div class="grid">
 <section class="glass-card tempos"><h3>Tempo de preparo e entrega</h3><p>Apenas intervalos concluídos com horários válidos. Preparo começa ao entrar na cozinha.</p>
 @for(t of a.tempos; track t.tipo; let i = $index){<div class="metrica" [style.--metric-color]="cores[i % cores.length]"><div class="linha"><span>{{ nomes[t.tipo] }}</span><strong>{{ t.minutos === null ? 'Sem dados' : t.minutos + ' min' }}</strong></div><div class="barra" role="meter" [attr.aria-label]="nomes[t.tipo]" aria-valuemin="0" [attr.aria-valuemax]="maxTempo()" [attr.aria-valuenow]="t.minutos" [attr.aria-valuetext]="t.minutos === null ? 'Sem dados' : t.minutos + ' minutos'"><span [style.width.%]="(t.minutos ?? 0) / maxTempo() * 100"></span></div><small>{{ t.amostras }} intervalos medidos</small></div>}
 </section>
 <section class="glass-card conversao"><h3>Conversão dos atendimentos</h3><p>Pedidos / todos os {{ a.atendimentos.total }} atendimentos iniciados no período.</p><div class="conversao-resumo">
 <div class="anel" role="img" [attr.aria-label]="a.atendimentos.conversao === null ? 'Conversão sem dados' : 'Conversão: ' + a.atendimentos.conversao + '%'">
 <svg viewBox="0 0 120 120" aria-hidden="true"><circle class="anel-base" cx="60" cy="60" r="50"/><circle class="anel-valor" cx="60" cy="60" r="50" pathLength="100" [attr.stroke-dasharray]="percentual(a.atendimentos.conversao) + ' 100'"/></svg>
 <div class="anel-texto"><strong>{{ a.atendimentos.conversao === null ? '—' : a.atendimentos.conversao + '%' }}</strong><span>{{a.atendimentos.conversao === null ? 'Sem dados' : 'Conversão'}}</span></div>
 </div><div class="resumo-texto"><strong>{{a.atendimentos.total}}</strong><span>atendimentos iniciados</span><small>Últimos {{a.dias}} dias</small></div></div>
 @for(s of a.atendimentos.status; track s.nome; let i = $index){<div class="metrica" [style.--metric-color]="cores[i % cores.length]"><div class="linha"><span class="ponto" aria-hidden="true"></span><span>{{ nomes[s.nome] || s.nome }}</span><strong>{{s.total}}</strong></div><div class="barra" role="meter" [attr.aria-label]="nomes[s.nome] || s.nome" aria-valuemin="0" [attr.aria-valuemax]="a.atendimentos.total || 1" [attr.aria-valuenow]="s.total"><span [style.width.%]="percentual(s.total / (a.atendimentos.total || 1) * 100)"></span></div></div>}
 </section>
 <section class="glass-card"><h3>Abandono por etapa</h3><p>Registros antigos sem etapa aparecem como não registrados.</p>
 @for(s of a.atendimentos.abandonos; track s.nome){<div class="linha"><span>{{ nomes[s.nome] || s.nome }}</span><strong>{{s.total}}</strong></div><meter min="0" [max]="a.atendimentos.total || 1" [value]="s.total" [attr.aria-label]="s.nome"></meter>} @empty {<p>Nenhum abandono no período.</p>}
 </section>
 <section class="glass-card"><h3>Cancelamentos por motivo</h3><p>Cancelamentos excluídos do faturamento e do ticket médio.</p>
 @for(s of a.cancelamentos; track s.nome){<div class="linha"><span>{{s.nome}}</span><strong>{{s.total}}</strong></div><meter min="0" [max]="maxCancelamentos()" [value]="s.total" [attr.aria-label]="s.nome"></meter>} @empty {<p>Nenhum cancelamento no período.</p>}
 </section></div>
 } @else {<p role="status">{{ erro() ? 'Indicadores indisponíveis.' : 'Carregando indicadores…' }}</p>}
 `, styles: [`:host{display:block}section{padding:22px;min-width:0}h3{font-size:1.05rem}p,small{color:var(--text-muted);font-size:.8rem;margin:8px 0 16px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;margin-top:20px}.scroll{overflow-x:auto}table{width:100%;border-collapse:separate;border-spacing:4px;font-size:.72rem}th{white-space:nowrap}td{min-width:26px;text-align:center;border-radius:4px;height:28px;color:#fff}.aberto{outline:1px solid var(--text-muted)}.linha{display:flex;justify-content:space-between;gap:12px;margin-top:14px}meter{width:100%;height:12px;appearance:none;background:var(--bg-surface-elevated);border:0;border-radius:99px}meter::-webkit-meter-bar{background:var(--bg-surface-elevated);border:0;border-radius:99px}meter::-webkit-meter-optimum-value{background:var(--primary);border-radius:99px}meter::-moz-meter-bar{background:var(--primary);border-radius:99px}
 .metrica{margin-top:20px;--metric-color:var(--primary)}.metrica .linha{align-items:center;margin:0 0 10px;font-size:.86rem}.linha strong{margin-left:auto}.metrica small{display:block;margin:8px 0 0;font-size:.73rem}.barra{height:8px;background:var(--bg-surface-elevated);border-radius:99px;overflow:hidden}.barra span{display:block;height:100%;background:var(--metric-color);border-radius:inherit}.ponto{width:8px;height:8px;border-radius:50%;background:var(--metric-color);flex-shrink:0;margin-right:-4px}.conversao-resumo{display:flex;align-items:center;gap:24px;margin:24px 0}.anel{width:144px;height:144px;position:relative;flex-shrink:0}.anel svg{width:100%;height:100%;transform:rotate(-90deg)}.anel circle{fill:none;stroke-width:9}.anel-base{stroke:var(--bg-surface-elevated)}.anel-valor{stroke:var(--primary);stroke-linecap:round}.anel-texto{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}.anel-texto strong{font-size:1.6rem;color:var(--text-primary)}.anel-texto span,.resumo-texto span{font-size:.75rem;color:var(--text-muted)}.resumo-texto{display:flex;flex-direction:column;gap:6px}.resumo-texto strong{font-size:1.8rem}.resumo-texto small{margin:0;font-size:.73rem}@media(max-width:400px){.conversao-resumo{gap:14px}.anel{width:120px;height:120px}}.numero{font-size:2rem;color:var(--primary-text)}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}@media(max-width:800px){.grid{grid-template-columns:1fr}}`]
})
export class DashboardAnalisesComponent implements OnChanges, OnDestroy {
 @Input() dias = 7; @Input() atualizacao = 0;
 private api = inject(ApiService); private requisicao?: Subscription;
 atualizando = signal(false);
 dados = signal<AnalisesDashboard | null>(null); erro = signal<string | null>(null);
 cores = ['var(--primary)', 'var(--ds-secondary)', 'var(--ds-accent)', 'var(--info)', 'var(--warning)'];
 percentual(valor: number | null){return Math.max(0, Math.min(100, valor ?? 0));}
 horas = Array.from({length:24},(_,i)=>i); semana=['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
 nomes: Record<string,string> = {preparo:'Preparo',entrega:'Entrega',total:'Pedido até entrega',em_andamento:'Em andamento',finalizado_com_pedido:'Com pedido',finalizado_sem_pedido:'Sem pedido',abandonado:'Abandonados',transbordo_humano:'Atendimento humano',conversa_iniciada:'Início',fazendo_pedido_pratos:'Escolha dos pratos',fazendo_pedido_bebidas:'Bebidas',coletando_endereco:'Endereço',coletando_pagamento:'Pagamento'};
 ngOnChanges(){this.carregar();} ngOnDestroy(){this.requisicao?.unsubscribe();}
 carregar(){this.requisicao?.unsubscribe();this.erro.set(null);this.atualizando.set(true);this.requisicao=this.api.getAnalises(this.dias).subscribe({next:a=>{this.dados.set(a);this.atualizando.set(false);},error:()=>{this.atualizando.set(false);this.erro.set(this.dados() ? 'Não foi possível atualizar os indicadores. Exibindo a última atualização.' : 'Não foi possível carregar os indicadores. Verifique a API.');}});}
 maxTempo(){return Math.max(1,...(this.dados()?.tempos.map(t=>t.minutos??0)??[]));}
 maxCancelamentos(){return Math.max(1,...(this.dados()?.cancelamentos.map(s=>s.total)??[]));}
 cor(q:number){const max=Math.max(1,...(this.dados()?.demanda.flatMap(d=>d.horas.map(h=>h.pedidos))??[]));return q ? 'rgba(var(--primary-rgb),'+(0.2+q/max*0.65)+')':'rgba(255,255,255,.04)';}
}
