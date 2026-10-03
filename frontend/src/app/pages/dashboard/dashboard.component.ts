import { PedidosRecentesComponent } from '../../shared/ui/pedidos-recentes.component';
import { Component, OnInit, OnDestroy, inject, signal, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDatepickerModule, MatDatepickerIntl } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { provideNativeDateAdapter, MAT_DATE_LOCALE, DateAdapter } from '@angular/material/core';
import { DataBrasileiraAdapter, calendarioPortugues } from '../../core/date-adapter';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService, PeriodoDashboard } from '../../core/services/api.service';
import { Chart, registerables } from 'chart.js';
import { TopProduto, MapaBairro, FormaPagamentoStat } from '../../core/models/dashboard.model';

import { DashboardAnalisesComponent } from './dashboard-analises.component';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, DashboardAnalisesComponent, PedidosRecentesComponent, ReactiveFormsModule, MatDatepickerModule, MatFormFieldModule],
  providers: [provideNativeDateAdapter(), {provide: DateAdapter, useClass: DataBrasileiraAdapter}, {provide: MatDatepickerIntl, useFactory: calendarioPortugues}, {provide: MAT_DATE_LOCALE, useValue: 'pt-BR'}],
  template: `
    <div class="dashboard-page">
      <!-- Top Title & Quick Filter -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Operação do restaurante</h1>
          <p class="page-subtitle">Pedidos, cozinha e entregas em um só lugar</p>
        </div>

        <div class="header-actions">
          <button class="refresh-btn glass-card" (click)="carregarTudo()" title="Atualizar Métricas">
            🔄 Atualizar
          </button>
          <div class="period-toggle">
            <button class="period-btn" [class.active]="!periodo() && diasGrafico() === 7" [attr.aria-pressed]="!periodo() && diasGrafico() === 7" (click)="setDias(7)">Últimos 7 dias</button>
            <button class="period-btn" [class.active]="!periodo() && diasGrafico() === 30" [attr.aria-pressed]="!periodo() && diasGrafico() === 30" (click)="setDias(30)">30 dias</button>
          </div>
        </div>
      </div>
      <div class="filtro-datas">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Período personalizado</mat-label>
          <mat-date-range-input [formGroup]="datas" [rangePicker]="calendario">
            <input matStartDate formControlName="inicio" placeholder="Data inicial" aria-label="Data inicial">
            <input matEndDate formControlName="fim" placeholder="Data final" aria-label="Data final">
          </mat-date-range-input>
          <mat-datepicker-toggle matIconSuffix [for]="calendario"></mat-datepicker-toggle>
          <mat-date-range-picker #calendario panelClass="calendario-restaurante"></mat-date-range-picker>
        </mat-form-field>
        <button class="btn btn-primary" type="button" [disabled]="datas.invalid || !datas.value.inicio || !datas.value.fim" (click)="aplicarDatas()">Aplicar datas</button>
        @if (erroDatas()) {<span role="alert" class="erro-datas">{{erroDatas()}}</span>}
        @if (datas.invalid && datas.touched) {<span role="alert" class="erro-datas">Informe datas válidas em DD/MM/AAAA, com o fim igual ou posterior ao início.</span>}
        <span class="periodo-descricao">{{rotuloPeriodo()}}</span>
      </div>

      <!-- Live Order Status Flow -->
      <div class="status-funnel-card glass-card">
        <div class="funnel-header">
          <h3>Situação dos pedidos</h3>
          <a routerLink="/pedidos" class="btn btn-secondary btn-sm">Ver Todos os Pedidos ➔</a>
        </div>
        <p style="color:var(--text-muted);font-size:.8rem;margin-bottom:12px">Todos os pedidos registrados · posição atual</p>
        <div class="funnel-grid">
          <div class="funnel-item pending">
            <span class="funnel-dot"></span>
            <span class="funnel-count">{{ api.kpis()?.pedidos_por_status?.pendente ?? 0 }}</span>
            <span class="funnel-label">Aguardando confirmação</span>
          </div>
          <div class="funnel-arrow">➜</div>
          <div class="funnel-item confirmed"><span class="funnel-count">{{api.kpis()?.pedidos_por_status?.confirmado ?? 0}}</span><span class="funnel-label">Confirmados</span></div>
          <div class="funnel-item prep">
            <span class="funnel-dot"></span>
            <span class="funnel-count">{{ api.kpis()?.pedidos_por_status?.em_preparo ?? 0 }}</span>
            <span class="funnel-label">Em preparação</span>
          </div>
          <div class="funnel-arrow">➜</div>
          <div class="funnel-item delivery">
            <span class="funnel-dot"></span>
            <span class="funnel-count">{{ api.kpis()?.pedidos_por_status?.saiu_para_entrega ?? 0 }}</span>
            <span class="funnel-label">Em Rota</span>
          </div>
          <div class="funnel-arrow">➜</div>
          <div class="funnel-item delivered">
            <span class="funnel-dot"></span>
            <span class="funnel-count">{{ api.kpis()?.pedidos_por_status?.entregue ?? 0 }}</span>
            <span class="funnel-label">Entregues</span>
          </div>
          <div class="funnel-item canceled"><span class="funnel-count">{{api.kpis()?.pedidos_por_status?.cancelado ?? 0}}</span><span class="funnel-label">Cancelados</span></div>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div class="kpi-grid">
        <!-- Faturamento Hoje -->
        <div class="glass-card kpi-card highlight">
          <div class="kpi-icon-wrap amber"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18v12H3zM3 10h18M7 15h3"/></svg></div>
          <div class="kpi-content">
            <span class="kpi-label">Faturamento Hoje</span>
            <h2 class="kpi-value">{{ (api.kpis()?.faturamento_hoje ?? 0) | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</h2>
            <div class="kpi-subtext positive">
              <span>●</span>
              <span>{{ api.kpis()?.pedidos_hoje ?? 0 }} pedidos hoje</span>
            </div>
          </div>
        </div>

        <!-- Faturamento Acumulado -->
        <div class="glass-card kpi-card">
          <div class="kpi-icon-wrap emerald"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5m0 14h16M7 14l4-4 4 2 5-7"/></svg></div>
          <div class="kpi-content">
            <span class="kpi-label">Faturamento Total</span>
            <h2 class="kpi-value">{{ (api.kpis()?.faturamento_total ?? 0) | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</h2>
            <div class="kpi-subtext">
              <span>{{ api.kpis()?.total_pedidos ?? 0 }} pedidos registrados</span>
            </div>
          </div>
        </div>

        <!-- Ticket Médio -->
        <div class="glass-card kpi-card">
          <div class="kpi-icon-wrap blue"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h8l10 10-8 8L3 11z"/><circle cx="7.5" cy="7.5" r="1"/></svg></div>
          <div class="kpi-content">
            <span class="kpi-label">Ticket Médio</span>
            <h2 class="kpi-value">{{ (api.kpis()?.ticket_medio ?? 0) | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</h2>
            <div class="kpi-subtext">
              <span>Pedidos sem cancelamento · todos os períodos</span>
            </div>
          </div>
        </div>

        <!-- Conversão IA -->
        <div class="glass-card kpi-card">
          <div class="kpi-icon-wrap purple"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14v13H5zM12 3v4M2 11v5m20-5v5M9 16h6"/><circle cx="9" cy="11" r="1"/><circle cx="15" cy="11" r="1"/></svg></div>
          <div class="kpi-content">
            <span class="kpi-label">Conversão da IA</span>
            <h2 class="kpi-value">{{ (api.kpis()?.taxa_conversao_ia ?? 0) }}%</h2>
            <div class="kpi-subtext positive">
              <span>{{ api.kpis()?.taxa_transbordo ?? 0 }}% transbordo humano</span>
            </div>
          </div>
        </div>
      </div>



      <!-- Charts Row -->
      <div class="charts-row">
        <!-- Sales Evolution Chart -->
        <div class="glass-card chart-card large">
          <div class="chart-header">
            <div>
              <h3>Evolução de Vendas & Faturamento</h3>
              <p>Faturamento e ticket médio · {{rotuloPeriodo()}}</p>
              <div class="chart-key"><span><i class="key-receita"></i>Faturamento</span><span><i class="key-ticket"></i>Ticket médio</span></div>
            </div>
          </div>
          <div class="chart-canvas-wrap">
            <canvas #salesCanvas></canvas>
          </div>
        </div>

        <!-- Payment Methods Donut Chart -->
        <div class="glass-card chart-card small">
          <div class="chart-header">
            <div>
              <h3>Formas de Pagamento</h3>
              <p>Distribuição do faturamento por método · {{rotuloPeriodo()}}</p>
            </div>
          </div>
          <div class="chart-canvas-wrap doughnut">
            <canvas #paymentCanvas></canvas>
            @if (pagamentos().length) {<div class="donut-centro"><strong>{{participacaoPrincipal()}}%</strong><span>{{nomePagamento(pagamentos()[0].forma_pagamento)}}</span></div>} @else {<div class="donut-centro"><span>Sem dados</span></div>}
          </div>
        </div>
      </div>

      <app-pedidos-recentes [atualizacao]="atualizacao()" />

      <app-dashboard-analises [dias]="diasGrafico()" [periodo]="periodo()" [atualizacao]="atualizacao()" />

      <!-- Bottom Tables & Rankings Row -->
      <div class="bottom-grid">
        <!-- Top Products Leaderboard -->
        <div class="glass-card table-card">
          <div class="card-header-clean">
            <h3>Pratos e Bebidas Mais Vendidos</h3>
            <span class="badge badge-prep">{{rotuloPeriodo()}}</span>
          </div>
          <div class="rank-list">
            @for (item of topProdutos(); track item.produto + item.tamanho; let i = $index) {
              <div class="rank-item">
                <div class="rank-pos">{{ i + 1 }}</div>
                <div class="rank-info">
                  <div class="rank-title">
                    <strong>{{ item.produto }}</strong>
                    <span class="item-size">{{ item.tamanho }}</span>
                  </div>
                  <div class="rank-bar-bg">
                    <div class="rank-bar-fill" [style.width.%]="(item.total_quantidade / (topProdutos()[0].total_quantidade || 1)) * 100"></div>
                  </div>
                </div>
                <div class="rank-values">
                  <span class="rank-qty">{{ item.total_quantidade }} un.</span>
                  <span class="rank-money">{{ item.total_faturado | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Heatmap por Bairro -->
        <div class="glass-card table-card">
          <div class="card-header-clean">
            <h3>Entregas por Bairro (Caraguatatuba)</h3>
            <span class="badge badge-delivery">{{rotuloPeriodo()}}</span>
          </div>
          <div class="bairros-list">
            @for (b of mapaBairros(); track b.bairro) {
              <div class="bairro-item">
                <div class="bairro-name">
                  <span>📍 {{ b.bairro }}</span>
                  <strong>{{ b.total_pedidos }} pedidos</strong>
                </div>
                <div class="bairro-stats">
                  <div class="bairro-bar-bg">
                    <div class="bairro-bar-fill" [style.width.%]="(b.total_pedidos / (mapaBairros()[0]?.total_pedidos || 1)) * 100"></div>
                  </div>
                  <span class="bairro-rev">{{ b.total_faturamento | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-page {
      display: flex;
      flex-direction: column;
      gap: 24px;
      padding-bottom: 40px;
    }

    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
    }

    .page-title {
      font-size: 1.65rem;
      color: var(--text-primary);
    }

    .page-subtitle {
      font-size: 0.875rem;
      color: var(--text-muted);
      margin-top: 4px;
    }

    .period-toggle {
      display: flex;
      background: var(--bg-surface-elevated);
      padding: 4px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-color);
    }

    .period-btn {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      font-size: 0.8rem;
      font-weight: 600;
      padding: 6px 14px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .period-btn.active {
      background: var(--primary);
      color: var(--on-primary);
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 20px;
    }

    .kpi-card {
      display: flex;
      align-items: center;
      gap: 18px;
      padding: 22px;
    }

    .kpi-card.highlight {
      border-color: var(--primary);
      background: var(--bg-card);
    }

    .kpi-icon-wrap {
      width: 52px;
      height: 52px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.6rem;
      flex-shrink: 0;
    }

    .kpi-icon-wrap.amber { background: var(--primary-glow); border: 1px solid var(--primary); }
    .kpi-icon-wrap.emerald { background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); }
    .kpi-icon-wrap.blue { background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); }
    .kpi-icon-wrap.purple { background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(168, 85, 247, 0.3); }

    .kpi-content {
      display: flex;
      flex-direction: column;
    }

    .kpi-label {
      font-size: 0.8rem;
      color: var(--text-muted);
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .kpi-value {
      font-size: 1.65rem;
      color: var(--text-primary);
      margin: 2px 0 4px;
      line-height: 1.1;
    }

    .kpi-subtext {
      font-size: 0.775rem;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .kpi-subtext.positive {
      color: #34D399;
    }

    .status-funnel-card {
      padding: 20px 24px;
    }

    .funnel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .funnel-header h3 {
      font-size: 1.05rem;
      color: var(--text-primary);
    }

    .funnel-grid {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .funnel-item {
      flex: 1;
      min-width: 0;
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 4px;
    }

    @media(max-width:1200px){.funnel-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media(max-width:600px){.funnel-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    .funnel-item.confirmed { border-color: var(--primary); }
    .funnel-item.canceled { border-color: var(--danger); }
    .funnel-item.pending { border-color: rgba(245, 158, 11, 0.3); }
    .funnel-item.prep { border-color: rgba(59, 130, 246, 0.3); }
    .funnel-item.delivery { border-color: rgba(168, 85, 247, 0.3); }
    .funnel-item.delivered { border-color: rgba(16, 185, 129, 0.3); }

    .funnel-count {
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--text-primary);
    }

    .funnel-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      font-weight: 600;
      text-transform: uppercase;
    }

    .funnel-arrow {
      display: none;
      color: var(--text-muted);
      font-size: 1.2rem;
    }

    .charts-row {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 20px;
    }

    @media (max-width: 1024px) {
      .charts-row {
        grid-template-columns: 1fr;
      }
    }

    .chart-key{display:flex;gap:20px;margin-top:14px;font-size:.75rem;color:var(--text-secondary)}.chart-key span{display:flex;align-items:center;gap:8px}.chart-key i{width:9px;height:9px;border-radius:50%;display:inline-block}.key-receita{background:#8b84ff}.key-ticket{background:#ff69b4}
    .chart-card {
      padding: 22px;
      display: flex;
      flex-direction: column;
    }

    .chart-header {
      margin-bottom: 18px;
    }

    .chart-header h3 {
      font-size: 1.1rem;
      color: var(--text-primary);
    }

    .chart-header p {
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .chart-canvas-wrap {
      position: relative;
      height: 280px;
      width: 100%;
    }

    .chart-canvas-wrap.doughnut {
      height: 250px;
    }

    .bottom-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    @media (max-width: 900px) {
      .bottom-grid {
        grid-template-columns: 1fr;
      }
    }

    .table-card {
      padding: 22px;
    }

    .card-header-clean {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 18px;
    }

    .card-header-clean h3 {
      font-size: 1.1rem;
      color: var(--text-primary);
    }

    .rank-list, .bairros-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .rank-item {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .rank-pos {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: var(--bg-surface-elevated);
      color: var(--primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
      font-weight: 700;
      flex-shrink: 0;
    }

    .rank-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .rank-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.875rem;
      color: var(--text-primary);
    }

    .item-size {
      font-size: 0.725rem;
      color: var(--text-muted);
      background: var(--bg-surface-elevated);
      padding: 2px 6px;
      border-radius: 4px;
    }

    .rank-bar-bg {
      height: 6px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 9999px;
      overflow: hidden;
    }

    .rank-bar-fill {
      height: 100%;
      background: var(--primary);
      border-radius: 9999px;
      transition: width 0.8s ease-in-out;
    }

    .rank-values {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      min-width: 80px;
    }

    .rank-qty {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .rank-money {
      font-size: 0.75rem;
      color: #34D399;
      font-weight: 600;
    }

    .bairro-item {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .bairro-name {
      display: flex;
      justify-content: space-between;
      font-size: 0.875rem;
      color: var(--text-primary);
    }

    .bairro-stats {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .bairro-bar-bg {
      flex: 1;
      height: 6px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 9999px;
      overflow: hidden;
    }

    .bairro-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #3B82F6, #60A5FA);
      border-radius: 9999px;
    }

    .bairro-rev {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-secondary);
      min-width: 70px;
      text-align: right;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .refresh-btn {
      background: var(--bg-surface-elevated);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
      padding: 7px 14px;
      border-radius: var(--radius-sm);
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .refresh-btn:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .filtro-datas{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.filtro-datas mat-form-field{width:310px;max-width:100%}.erro-datas{color:var(--danger);font-size:.8rem}.periodo-descricao{font-size:.8rem;color:var(--text-muted)}
    /* Composição da referência visual enviada pelo usuário. */
    :host { --bg-card:#383849; --bg-surface-elevated:#444456; --border-color:#48485a; --text-muted:#b1afc2; }
    .glass-card { background:#383849; border:0; border-radius:8px; box-shadow:none; }
    .kpi-grid { grid-template-columns:repeat(4,minmax(0,1fr));gap:22px; }
    .kpi-card { padding:22px;gap:16px;min-height:100px; }
    .kpi-card.highlight { background:#383849;border:0; }
    .kpi-icon-wrap { width:44px;height:44px;border-radius:50%; }
    .kpi-icon-wrap svg { width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round; }
    .kpi-icon-wrap.amber,.kpi-icon-wrap.purple { background:rgba(96,92,255,.3);color:#8b84ff;border:0; }
    .kpi-icon-wrap.emerald {background:rgba(47,229,167,.25);color:#2fe5a7;border:0;}
    .kpi-icon-wrap.blue {background:rgba(255,105,180,.25);color:#ff69b4;border:0;}
    .kpi-content {min-width:0;}.kpi-value {order:-1;font-size:1.1rem;margin:0 0 4px;overflow-wrap:anywhere;}
    .kpi-label {text-transform:none;letter-spacing:0;font-size:.76rem;}.kpi-subtext {font-size:.65rem;margin-top:4px;color:var(--text-muted);}.kpi-subtext.positive{color:var(--text-muted)}
    .charts-row {grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:22px;}
    .chart-card {padding:22px 20px;}.chart-header h3{font-size:.95rem;font-weight:500;}.chart-header p{font-size:.72rem;}
    .chart-canvas-wrap.doughnut {position:relative;}.donut-centro{position:absolute;left:50%;top:43%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;pointer-events:none;gap:2px;}.donut-centro strong{font-size:1.6rem}.donut-centro span{font-size:.8rem;color:var(--text-secondary)}
    @media(max-width:1100px){.kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:800px){.charts-row{grid-template-columns:1fr}}
    @media(max-width:480px){.kpi-grid{grid-template-columns:1fr}}
  `]
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  api = inject(ApiService);
  diasGrafico = signal<number>(7);
  periodo = signal<PeriodoDashboard | null>(null);
  erroDatas = signal<string | null>(null);
  datas = new FormGroup({inicio: new FormControl<Date | null>(null), fim: new FormControl<Date | null>(null)});
  private dataLocal(data: Date) { return `${data.getFullYear()}-${String(data.getMonth()+1).padStart(2,'0')}-${String(data.getDate()).padStart(2,'0')}`; }
  rotuloPeriodo() { const p=this.periodo();return p ? `${p.inicio.split('-').reverse().join('/')} a ${p.fim.split('-').reverse().join('/')}` : `Últimos ${this.diasGrafico()} dias`; }
  aplicarDatas() {
    const {inicio,fim}=this.datas.getRawValue();
    this.erroDatas.set(null);
    if (this.datas.invalid || !inicio || !fim || !Number.isFinite(inicio.getTime()) || !Number.isFinite(fim.getTime())) return;
    const dias=(Date.UTC(fim.getFullYear(),fim.getMonth(),fim.getDate())-Date.UTC(inicio.getFullYear(),inicio.getMonth(),inicio.getDate()))/86400000+1;
    if(dias < 1 || dias > 365){this.erroDatas.set('Selecione um intervalo de 1 a 365 dias.');return;}
    this.periodo.set({inicio:this.dataLocal(inicio),fim:this.dataLocal(fim)});
    this.carregarTopProdutos();this.carregarMapaBairros();this.renderSalesChart();this.renderPaymentChart();
  }
  atualizacao = signal(0);
  pollingInterval: any = null;
  private consultas = new Map<string, Subscription>();
  private inicializacao?: ReturnType<typeof setTimeout>;
  private cancelarConsulta(chave: string) { this.consultas.get(chave)?.unsubscribe(); }

  topProdutos = signal<TopProduto[]>([]);
  mapaBairros = signal<MapaBairro[]>([]);
  pagamentos = signal<FormaPagamentoStat[]>([]);

  @ViewChild('salesCanvas') salesCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('paymentCanvas') paymentCanvas!: ElementRef<HTMLCanvasElement>;

  salesChartInstance: Chart | null = null;
  paymentChartInstance: Chart | null = null;

  ngOnDestroy() {
    clearInterval(this.pollingInterval);
    clearTimeout(this.inicializacao);
    this.consultas.forEach(consulta => consulta.unsubscribe());
    this.salesChartInstance?.destroy();
    this.paymentChartInstance?.destroy();
  }

  ngOnInit() {
    this.carregarTudo();
    // Auto-refresh a cada 10 segundos para acompanhar pedidos novos em tempo real
    this.pollingInterval = setInterval(() => {
      this.carregarDadosLeves();
    }, 10000);
  }

  ngAfterViewInit() {
    this.inicializacao = setTimeout(() => {
      this.renderSalesChart();
      this.renderPaymentChart();
    }, 100);
  }

  carregarTudo() {
    this.atualizacao.update(v => v + 1);
    this.api.getKpis().subscribe();
    this.carregarTopProdutos();
    this.carregarMapaBairros();
    if (this.salesCanvas) this.renderSalesChart();
    if (this.paymentCanvas) this.renderPaymentChart();
  }

  carregarDadosLeves() {
    this.atualizacao.update(v=>v+1);
    this.api.getKpis().subscribe();
    this.carregarTopProdutos();
    this.carregarMapaBairros();
    this.renderSalesChart();
    this.renderPaymentChart();
  }

  setDias(dias: number) {
    if (dias !== 7 && dias !== 30) return;
    this.periodo.set(null);
    this.erroDatas.set(null);
    this.datas.reset();
    this.diasGrafico.set(dias);
    this.carregarTopProdutos();
    this.renderSalesChart();
    this.carregarMapaBairros();
    this.renderPaymentChart();
  }

  carregarTopProdutos() {
    this.cancelarConsulta('produtos');
    this.consultas.set('produtos', this.api.getTopProducts(this.diasGrafico(), this.periodo()).subscribe((res) => this.topProdutos.set(res)));
  }

  carregarMapaBairros() {
    this.cancelarConsulta('bairros');
    this.consultas.set('bairros', this.api.getDeliveryHeatmap(this.diasGrafico(), this.periodo()).subscribe((res) => this.mapaBairros.set(res)));
  }

  renderSalesChart() {
    this.cancelarConsulta('vendas');
    this.consultas.set('vendas', this.api.getSalesChart(this.diasGrafico(), this.periodo()).subscribe((vendas) => {
      if (!this.salesCanvas?.nativeElement) return;
      if (this.salesChartInstance) this.salesChartInstance.destroy();

      const labels = vendas.map((v) => {
        if (!v.data) return '';
        const partes = v.data.split('-');
        return partes.length === 3 ? `${partes[2]}/${partes[1]}` : v.data;
      });
      const dataFaturamento = vendas.map((v) => Number(v.faturamento) || 0);

      this.salesChartInstance = new Chart(this.salesCanvas.nativeElement, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Faturamento (R$)',
            data: dataFaturamento,
            borderColor: '#8B84FF',
            backgroundColor: (context) => {
              const area=context.chart.chartArea;if(!area)return 'rgba(96,92,255,.15)';
              const gradient=context.chart.ctx.createLinearGradient(area.left,0,area.right,0);
              gradient.addColorStop(0,'rgba(96,92,255,.5)');gradient.addColorStop(1,'rgba(255,105,180,.38)');return gradient;
            },
            borderWidth: 0,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#383849',
            pointBorderColor: '#FF69B4',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 5,
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
            pointHitRadius: 20,
          }, {label: 'Ticket médio (R$)', data: vendas.map(v => v.ticket_medio ?? null), borderColor: '#FF69B4', backgroundColor: 'rgba(255,105,180,.05)', borderWidth: 2, tension: 0.4, pointRadius: 0, pointHoverRadius: 5, pointHitRadius: 20, fill: false}]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {mode:'index',intersect:false},
          animation: {duration:350},
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor:'#151B28',titleColor:'#fff',bodyColor:'#D8DDF0',padding:14,cornerRadius:10,borderColor:'#424B60',borderWidth:1,displayColors:true,usePointStyle:true,
              callbacks: {
                label: (ctx) => ` ${ctx.dataset.label}: ${Number(ctx.raw).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`
              }
            }
          },
          scales: {
            x: {
              border: {display:false},
              grid: {display:false},
              ticks: { color: '#AAB6CC',maxTicksLimit:7,maxRotation:0,padding:12 }
            },
            y: {
              beginAtZero:true,
              border: {display:false,dash:[4,6]},
              grid: { color: 'rgba(170,182,204,.12)',drawTicks:false },
              ticks: {
                color: '#AAB6CC',maxTicksLimit:5,padding:12,
                callback: (val) => `R$ ${val}`
              }
            }
          }
        }
      });
    }));
  }

  nomePagamento(tipo: string) { return ({pix:'Pix',cartao_credito:'Crédito',cartao_debito:'Débito',dinheiro:'Dinheiro'} as Record<string,string>)[tipo] || tipo; }
  participacaoPrincipal() { const total=this.pagamentos().reduce((s,p)=>s+Number(p.faturamento),0);return total>0?Math.round(Number(this.pagamentos()[0]?.faturamento ?? 0)/total*100):0; }
  renderPaymentChart() {
    this.cancelarConsulta('pagamentos');
    this.consultas.set('pagamentos', this.api.getPaymentMethods(this.diasGrafico(), this.periodo()).subscribe((pagamentos) => {
      this.pagamentos.set(pagamentos);
      if (!this.paymentCanvas?.nativeElement) return;
      if (this.paymentChartInstance) this.paymentChartInstance.destroy();

      const formatLabel = (tipo: string) => {
        const map: Record<string, string> = {
          pix: 'Pix',
          cartao_credito: 'Crédito',
          cartao_debito: 'Débito',
          dinheiro: 'Dinheiro'
        };
        return map[tipo] || tipo;
      };

      const labels = pagamentos.map((p) => formatLabel(p.forma_pagamento));
      const data = pagamentos.map((p) => Number(p.faturamento) || 0);

      this.paymentChartInstance = new Chart(this.paymentCanvas.nativeElement, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: ['#605CFF', '#2FE5A7', '#FF69B4', '#B1AFC2', '#7CB8FF'],
            borderColor: '#383849',
            borderWidth: 0,
            borderRadius: 20,
            hoverOffset: 5
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#D1D5DB', padding: 14, font: { size: 12 } }
            }
          },
          cutout: '78%'
        }
      });
    }));
  }
}

