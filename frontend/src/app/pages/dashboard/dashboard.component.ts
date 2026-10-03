import { Component, OnInit, OnDestroy, inject, signal, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { Chart, registerables } from 'chart.js';
import { TopProduto, MapaBairro, FormaPagamentoStat } from '../../core/models/dashboard.model';

import { DashboardAnalisesComponent } from './dashboard-analises.component';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, DashboardAnalisesComponent],
  template: `
    <div class="dashboard-page">
      <!-- Top Title & Quick Filter -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Painel Executivo & Métricas do WhatsApp</h1>
          <p class="page-subtitle">Acompanhamento em tempo real de vendas, entregas, comanda e conversões do bot</p>
        </div>

        <div class="header-actions">
          <button class="refresh-btn glass-card" (click)="carregarTudo()" title="Atualizar Métricas">
            🔄 Atualizar
          </button>
          <div class="period-toggle">
            <button class="period-btn" [class.active]="diasGrafico() === 7" (click)="setDias(7)">Últimos 7 dias</button>
            <button class="period-btn" [class.active]="diasGrafico() === 30" (click)="setDias(30)">30 dias</button>
          </div>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div class="kpi-grid">
        <!-- Faturamento Hoje -->
        <div class="glass-card kpi-card highlight">
          <div class="kpi-icon-wrap amber">💰</div>
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
          <div class="kpi-icon-wrap emerald">📈</div>
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
          <div class="kpi-icon-wrap blue">🏷️</div>
          <div class="kpi-content">
            <span class="kpi-label">Ticket Médio</span>
            <h2 class="kpi-value">{{ (api.kpis()?.ticket_medio ?? 0) | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</h2>
            <div class="kpi-subtext">
              <span>Base em {{ api.kpis()?.total_clientes ?? 0 }} clientes únicos</span>
            </div>
          </div>
        </div>

        <!-- Conversão IA -->
        <div class="glass-card kpi-card">
          <div class="kpi-icon-wrap purple">🤖</div>
          <div class="kpi-content">
            <span class="kpi-label">Conversão da IA</span>
            <h2 class="kpi-value">{{ (api.kpis()?.taxa_conversao_ia ?? 0) }}%</h2>
            <div class="kpi-subtext positive">
              <span>{{ api.kpis()?.taxa_transbordo ?? 0 }}% transbordo humano</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Live Order Status Flow -->
      <div class="status-funnel-card glass-card">
        <div class="funnel-header">
          <h3>Fluxo Operacional dos Pedidos em Tempo Real</h3>
          <a routerLink="/pedidos" class="btn btn-secondary btn-sm">Ver Todos os Pedidos ➔</a>
        </div>
        <div class="funnel-grid">
          <div class="funnel-item pending">
            <span class="funnel-dot"></span>
            <span class="funnel-count">{{ api.kpis()?.pedidos_por_status?.pendente ?? 0 }}</span>
            <span class="funnel-label">Pendentes</span>
          </div>
          <div class="funnel-arrow">➜</div>
          <div class="funnel-item prep">
            <span class="funnel-dot"></span>
            <span class="funnel-count">{{ api.kpis()?.pedidos_por_status?.em_preparo ?? 0 }}</span>
            <span class="funnel-label">Na Cozinha</span>
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
        </div>
      </div>

      <!-- Charts Row -->
      <div class="charts-row">
        <!-- Sales Evolution Chart -->
        <div class="glass-card chart-card large">
          <div class="chart-header">
            <div>
              <h3>Evolução de Vendas & Faturamento</h3>
              <p>Receita diária gerada pelo delivery via WhatsApp</p>
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
              <p>Distribuição do faturamento por método</p>
            </div>
          </div>
          <div class="chart-canvas-wrap doughnut">
            <canvas #paymentCanvas></canvas>
          </div>
        </div>
      </div>

      <app-dashboard-analises [dias]="diasGrafico()" [atualizacao]="atualizacao()" />

      <!-- Bottom Tables & Rankings Row -->
      <div class="bottom-grid">
        <!-- Top Products Leaderboard -->
        <div class="glass-card table-card">
          <div class="card-header-clean">
            <h3>Pratos e Bebidas Mais Vendidos</h3>
            <span class="badge badge-prep">Top Ranking</span>
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
            <span class="badge badge-delivery">Logística</span>
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
      color: #111827;
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
      border-color: rgba(245, 158, 11, 0.4);
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(17, 24, 39, 0.85));
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

    .kpi-icon-wrap.amber { background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); }
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
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .funnel-item {
      flex: 1;
      min-width: 140px;
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
      background: linear-gradient(90deg, #F59E0B, #FBBF24);
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
  `]
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  api = inject(ApiService);
  diasGrafico = signal<number>(7);
  atualizacao = signal(0);
  pollingInterval: any = null;

  topProdutos = signal<TopProduto[]>([]);
  mapaBairros = signal<MapaBairro[]>([]);
  pagamentos = signal<FormaPagamentoStat[]>([]);

  @ViewChild('salesCanvas') salesCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('paymentCanvas') paymentCanvas!: ElementRef<HTMLCanvasElement>;

  salesChartInstance: Chart | null = null;
  paymentChartInstance: Chart | null = null;

  ngOnDestroy() {
    clearInterval(this.pollingInterval);
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
    setTimeout(() => {
      this.renderSalesChart();
      this.renderPaymentChart();
    }, 100);
  }

  carregarTudo() {
    this.atualizacao.update(v => v + 1);
    this.api.getKpis().subscribe();
    this.carregarTopProdutos();
    this.carregarMapaBairros();
    this.carregarPagamentos();
    if (this.salesCanvas) this.renderSalesChart();
    if (this.paymentCanvas) this.renderPaymentChart();
  }

  carregarDadosLeves() {
    this.api.getKpis().subscribe();
    this.carregarTopProdutos();
    this.carregarMapaBairros();
  }

  setDias(dias: number) {
    this.diasGrafico.set(dias);
    this.carregarTopProdutos();
    this.renderSalesChart();
  }

  carregarTopProdutos() {
    this.api.getTopProducts(this.diasGrafico()).subscribe((res) => this.topProdutos.set(res));
  }

  carregarMapaBairros() {
    this.api.getDeliveryHeatmap().subscribe((res) => this.mapaBairros.set(res));
  }

  carregarPagamentos() {
    this.api.getPaymentMethods().subscribe((res) => this.pagamentos.set(res));
  }

  renderSalesChart() {
    this.api.getSalesChart(this.diasGrafico()).subscribe((vendas) => {
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
            borderColor: '#F59E0B',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#F59E0B',
            pointRadius: 4,
            pointHoverRadius: 6,
          }, {label: 'Ticket médio (R$)', data: vendas.map(v => v.ticket_medio ?? null), borderColor: '#34D399', backgroundColor: '#34D399', tension: 0.2, fill: false}]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: true, labels: { color: '#D1D5DB' } },
            tooltip: {
              callbacks: {
                label: (ctx) => ` R$ ${Number(ctx.raw).toFixed(2).replace('.', ',')}`
              }
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#9CA3AF' }
            },
            y: {
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: {
                color: '#9CA3AF',
                callback: (val) => `R$ ${val}`
              }
            }
          }
        }
      });
    });
  }

  renderPaymentChart() {
    this.api.getPaymentMethods().subscribe((pagamentos) => {
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
            backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6'],
            borderWidth: 0,
            hoverOffset: 6
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
          cutout: '70%'
        }
      });
    });
  }
}

