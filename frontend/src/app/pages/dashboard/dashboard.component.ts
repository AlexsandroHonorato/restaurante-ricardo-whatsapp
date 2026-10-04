import { PedidosRecentesComponent } from '../../shared/ui/pedidos-recentes.component';
import { anelSobreposto } from '../../shared/ui/anel-sobreposto';
import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  ElementRef,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
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
  imports: [
    CommonModule,
    RouterModule,
    DashboardAnalisesComponent,
    PedidosRecentesComponent,
    ReactiveFormsModule,
    MatDatepickerModule,
    MatFormFieldModule,
  ],
  providers: [
    provideNativeDateAdapter(),
    { provide: DateAdapter, useClass: DataBrasileiraAdapter },
    { provide: MatDatepickerIntl, useFactory: calendarioPortugues },
    { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' },
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  api = inject(ApiService);
  /** Sem resposta da API não há indicador: retorna null para a tela mostrar "—" em vez de um zero falso. */
  kpi(valor: number | undefined): number | null {
    return this.api.kpis() ? (valor ?? 0) : null;
  }
  diasGrafico = signal<number>(7);
  periodo = signal<PeriodoDashboard | null>(null);
  erroDatas = signal<string | null>(null);
  datas = new FormGroup({
    inicio: new FormControl<Date | null>(null),
    fim: new FormControl<Date | null>(null),
  });
  private dataLocal(data: Date) {
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
  }
  rotuloPeriodo() {
    const p = this.periodo();
    return p
      ? `${p.inicio.split('-').reverse().join('/')} a ${p.fim.split('-').reverse().join('/')}`
      : `Últimos ${this.diasGrafico()} dias`;
  }
  aplicarDatas() {
    const { inicio, fim } = this.datas.getRawValue();
    this.erroDatas.set(null);
    if (
      this.datas.invalid ||
      !inicio ||
      !fim ||
      !Number.isFinite(inicio.getTime()) ||
      !Number.isFinite(fim.getTime())
    )
      return;
    const dias =
      (Date.UTC(fim.getFullYear(), fim.getMonth(), fim.getDate()) -
        Date.UTC(inicio.getFullYear(), inicio.getMonth(), inicio.getDate())) /
        86400000 +
      1;
    if (dias < 1 || dias > 365) {
      this.erroDatas.set('Selecione um intervalo de 1 a 365 dias.');
      return;
    }
    this.periodo.set({ inicio: this.dataLocal(inicio), fim: this.dataLocal(fim) });
    this.carregarTopProdutos();
    this.carregarMapaBairros();
    this.renderSalesChart();
    this.renderPaymentChart();
  }
  atualizacao = signal(0);
  pollingInterval: any = null;
  private consultas = new Map<string, Subscription>();
  private inicializacao?: ReturnType<typeof setTimeout>;
  private cancelarConsulta(chave: string) {
    this.consultas.get(chave)?.unsubscribe();
  }

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
    this.consultas.forEach((consulta) => consulta.unsubscribe());
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
    this.atualizacao.update((v) => v + 1);
    this.api.getKpis().subscribe();
    this.carregarTopProdutos();
    this.carregarMapaBairros();
    if (this.salesCanvas) this.renderSalesChart();
    if (this.paymentCanvas) this.renderPaymentChart();
  }

  carregarDadosLeves() {
    this.atualizacao.update((v) => v + 1);
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
    this.consultas.set(
      'produtos',
      this.api
        .getTopProducts(this.diasGrafico(), this.periodo())
        .subscribe((res) => this.topProdutos.set(res)),
    );
  }

  carregarMapaBairros() {
    this.cancelarConsulta('bairros');
    this.consultas.set(
      'bairros',
      this.api
        .getDeliveryHeatmap(this.diasGrafico(), this.periodo())
        .subscribe((res) => this.mapaBairros.set(res)),
    );
  }

  renderSalesChart() {
    this.cancelarConsulta('vendas');
    this.consultas.set(
      'vendas',
      this.api.getSalesChart(this.diasGrafico(), this.periodo()).subscribe((vendas) => {
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
            datasets: [
              {
                label: 'Faturamento (R$)',
                data: dataFaturamento,
                borderColor: '#8B84FF',
                backgroundColor: (context) => {
                  const area = context.chart.chartArea;
                  if (!area) return 'rgba(96,92,255,.15)';
                  const gradient = context.chart.ctx.createLinearGradient(
                    area.left,
                    0,
                    area.right,
                    0,
                  );
                  gradient.addColorStop(0, 'rgba(96,92,255,.5)');
                  gradient.addColorStop(1, 'rgba(255,105,180,.38)');
                  return gradient;
                },
                borderWidth: 3,
                fill: false,
                tension: 0.4,
                pointBackgroundColor: '#383849',
                pointBorderColor: '#FF69B4',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 5,
                pointHoverBorderColor: '#fff',
                pointHoverBorderWidth: 2,
                pointHitRadius: 20,
              },
              {
                label: 'Ticket médio (R$)',
                data: vendas.map((v) => v.ticket_medio ?? null),
                borderColor: '#FF69B4',
                backgroundColor: 'rgba(255,105,180,.05)',
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 5,
                pointHitRadius: 20,
                fill: false,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            animation: { duration: 350 },
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: '#151B28',
                titleColor: '#fff',
                bodyColor: '#D8DDF0',
                padding: 14,
                cornerRadius: 10,
                borderColor: '#424B60',
                borderWidth: 1,
                displayColors: true,
                usePointStyle: true,
                callbacks: {
                  label: (ctx) =>
                    ` ${ctx.dataset.label}: ${Number(ctx.raw).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
                },
              },
            },
            scales: {
              x: {
                border: { display: false },
                grid: { display: false },
                ticks: { color: '#AAB6CC', maxTicksLimit: 7, maxRotation: 0, padding: 12 },
              },
              y: {
                beginAtZero: true,
                border: { display: false, dash: [4, 6] },
                grid: { color: 'rgba(170,182,204,.12)', drawTicks: false },
                ticks: {
                  color: '#AAB6CC',
                  maxTicksLimit: 5,
                  padding: 12,
                  callback: (val) => `R$ ${val}`,
                },
              },
            },
          },
        });
      }),
    );
  }

  nomePagamento(tipo: string) {
    return (
      (
        {
          pix: 'Pix',
          cartao_credito: 'Crédito',
          cartao_debito: 'Débito',
          dinheiro: 'Dinheiro',
        } as Record<string, string>
      )[tipo] || tipo
    );
  }
  participacaoPrincipal() {
    const total = this.pagamentos().reduce((s, p) => s + Number(p.faturamento), 0);
    return total > 0
      ? Math.round((Number(this.pagamentos()[0]?.faturamento ?? 0) / total) * 100)
      : 0;
  }
  renderPaymentChart() {
    this.cancelarConsulta('pagamentos');
    this.consultas.set(
      'pagamentos',
      this.api.getPaymentMethods(this.diasGrafico(), this.periodo()).subscribe((pagamentos) => {
        this.pagamentos.set(pagamentos);
        if (!this.paymentCanvas?.nativeElement) return;
        if (this.paymentChartInstance) this.paymentChartInstance.destroy();

        const formatLabel = (tipo: string) => {
          const map: Record<string, string> = {
            pix: 'Pix',
            cartao_credito: 'Crédito',
            cartao_debito: 'Débito',
            dinheiro: 'Dinheiro',
          };
          return map[tipo] || tipo;
        };

        const labels = pagamentos.map((p) => formatLabel(p.forma_pagamento));
        const data = pagamentos.map((p) => Number(p.faturamento) || 0);

        this.paymentChartInstance = new Chart(this.paymentCanvas.nativeElement, {
          type: 'doughnut',
          plugins: [anelSobreposto],
          data: {
            labels,
            datasets: [
              {
                data,
                backgroundColor: ['#605CFF', '#2FE5A7', '#FF69B4', '#B1AFC2', '#7CB8FF'],
                borderColor: '#383849',
                borderWidth: 0,
                borderRadius: 20,
                hoverOffset: 5,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  color: '#B1AFC2',
                  padding: 18,
                  usePointStyle: true,
                  pointStyle: 'rectRounded',
                  font: { size: 12 },
                },
              },
            },
            layout: { padding: 10 },
            cutout: '76%',
          },
        });
      }),
    );
  }
}
