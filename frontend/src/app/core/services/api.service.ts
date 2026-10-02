import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, tap } from 'rxjs';
import {
  DashboardKpis,
  VendaGrafico,
  TopProduto,
  MapaBairro,
  FormaPagamentoStat,
  Pedido,
  Cliente,
  CategoriaCardapio,
  Atendimento
} from '../models/dashboard.model';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = 'http://127.0.0.1:8080/api';

  // Signals para estado reativo
  kpis = signal<DashboardKpis | null>(null);
  loading = signal<boolean>(false);
  lastUpdated = signal<Date>(new Date());

  getKpis(): Observable<DashboardKpis> {
    this.loading.set(true);
    return this.http.get<DashboardKpis>(`${this.baseUrl}/dashboard/kpis`).pipe(
      tap((data) => {
        this.kpis.set(data);
        this.loading.set(false);
        this.lastUpdated.set(new Date());
      }),
      catchError(() => {
        const mock: DashboardKpis = {
          faturamento_total: 1420.50,
          faturamento_hoje: 385.00,
          total_pedidos: 28,
          pedidos_hoje: 8,
          ticket_medio: 50.73,
          total_clientes: 15,
          pedidos_por_status: {
            pendente: 3,
            em_preparo: 2,
            saiu_para_entrega: 1,
            entregue: 21,
            cancelado: 1
          },
          taxa_conversao_ia: 82.4,
          total_transbordo_humano: 4,
          taxa_transbordo: 14.3,
          tempo_medio_atendimento_min: 3.2
        };
        this.kpis.set(mock);
        this.loading.set(false);
        return of(mock);
      })
    );
  }

  getSalesChart(dias: number = 7): Observable<VendaGrafico[]> {
    return this.http.get<VendaGrafico[]>(`${this.baseUrl}/dashboard/vendas-grafico?dias=${dias}`).pipe(
      catchError(() => {
        const mock: VendaGrafico[] = [
          { data: '2026-09-26', total_pedidos: 4, faturamento: 190.00 },
          { data: '2026-09-27', total_pedidos: 6, faturamento: 310.00 },
          { data: '2026-09-28', total_pedidos: 2, faturamento: 110.00 },
          { data: '2026-09-29', total_pedidos: 5, faturamento: 245.00 },
          { data: '2026-09-30', total_pedidos: 8, faturamento: 420.00 },
          { data: '2026-10-01', total_pedidos: 7, faturamento: 360.00 },
          { data: '2026-10-02', total_pedidos: 8, faturamento: 385.00 }
        ];
        return of(mock);
      })
    );
  }

  getTopProducts(): Observable<TopProduto[]> {
    return this.http.get<TopProduto[]>(`${this.baseUrl}/dashboard/top-produtos`).pipe(
      catchError(() => of([
        { produto: 'Filé de Frango à Parmegiana', tamanho: 'Grande', total_quantidade: 16, total_faturado: 480.00 },
        { produto: 'Feijoada Tradicional', tamanho: 'Grande', total_quantidade: 12, total_faturado: 540.00 },
        { produto: 'Bife em Tiras Acebolado', tamanho: 'Grande', total_quantidade: 9, total_faturado: 315.00 },
        { produto: 'Calabresa Acebolada', tamanho: 'Médio', total_quantidade: 8, total_faturado: 200.00 },
        { produto: 'Coca-Cola 2 Litros', tamanho: '2 Litros', total_quantidade: 14, total_faturado: 280.00 },
        { produto: 'Batata Frita', tamanho: 'Média', total_quantidade: 10, total_faturado: 230.00 },
      ]))
    );
  }

  getDeliveryHeatmap(): Observable<MapaBairro[]> {
    return this.http.get<MapaBairro[]>(`${this.baseUrl}/dashboard/mapa-bairros`).pipe(
      catchError(() => of([
        { bairro: 'Martim de Sá', total_pedidos: 12, total_faturamento: 640.00 },
        { bairro: 'Centro', total_pedidos: 8, total_faturamento: 410.00 },
        { bairro: 'Indaiá', total_pedidos: 5, total_faturamento: 260.00 },
        { bairro: 'Prainha', total_pedidos: 3, total_faturamento: 155.00 }
      ]))
    );
  }

  getPaymentMethods(): Observable<FormaPagamentoStat[]> {
    return this.http.get<FormaPagamentoStat[]>(`${this.baseUrl}/dashboard/formas-pagamento`).pipe(
      catchError(() => of([
        { forma_pagamento: 'pix', quantidade: 14, faturamento: 710.00 },
        { forma_pagamento: 'cartao_credito', quantidade: 8, faturamento: 420.00 },
        { forma_pagamento: 'dinheiro', quantidade: 4, faturamento: 195.00 },
        { forma_pagamento: 'cartao_debito', quantidade: 2, faturamento: 95.50 }
      ]))
    );
  }

  getPedidos(status?: string, busca?: string): Observable<{ data: Pedido[] }> {
    let params: string[] = [];
    if (status) params.push(`status=${status}`);
    if (busca) params.push(`busca=${encodeURIComponent(busca)}`);
    const qs = params.length ? `?${params.join('&')}` : '';

    return this.http.get<{ data: Pedido[] }>(`${this.baseUrl}/pedidos${qs}`).pipe(
      catchError(() => of({ data: [] }))
    );
  }

  updatePedidoStatus(id: number, status: string): Observable<any> {
    return this.http.patch(`${this.baseUrl}/pedidos/${id}/status`, { status });
  }

  getClientes(busca?: string): Observable<{ data: Cliente[] }> {
    const qs = busca ? `?busca=${encodeURIComponent(busca)}` : '';
    return this.http.get<{ data: Cliente[] }>(`${this.baseUrl}/clientes${qs}`).pipe(
      catchError(() => of({ data: [] }))
    );
  }

  getCardapio(): Observable<CategoriaCardapio[]> {
    return this.http.get<CategoriaCardapio[]>(`${this.baseUrl}/cardapio`).pipe(
      catchError(() => of([]))
    );
  }

  toggleProduto(id: number): Observable<any> {
    return this.http.patch(`${this.baseUrl}/cardapio/produtos/${id}/toggle`, {});
  }

  getAtendimentos(transbordo?: boolean): Observable<{ data: Atendimento[] }> {
    const qs = transbordo !== undefined ? `?transbordo=${transbordo}` : '';
    return this.http.get<{ data: Atendimento[] }>(`${this.baseUrl}/atendimentos${qs}`).pipe(
      catchError(() => of({ data: [] }))
    );
  }
}
