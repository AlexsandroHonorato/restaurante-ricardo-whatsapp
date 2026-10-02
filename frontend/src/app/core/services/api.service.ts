import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, tap, EMPTY, finalize } from 'rxjs';
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

  erro = signal<string | null>(null);

  private registrarFalha() {
    this.erro.set('Não foi possível atualizar os dados. Verifique a conexão com a API.');
  }

  // Signals para estado reativo
  kpis = signal<DashboardKpis | null>(null);
  loading = signal<boolean>(false);
  lastUpdated = signal<Date>(new Date());

  getKpis(): Observable<DashboardKpis> {
    this.loading.set(true);
    return this.http.get<DashboardKpis>(`${this.baseUrl}/dashboard/kpis`).pipe(
      tap((data) => {
        this.erro.set(null);
        this.kpis.set(data);
        this.loading.set(false);
        this.lastUpdated.set(new Date());
      }),
      catchError(() => {
        this.registrarFalha();
        return EMPTY;
      }),
      finalize(() => this.loading.set(false))
    );
  }

  getSalesChart(dias: number = 7): Observable<VendaGrafico[]> {
    return this.http.get<VendaGrafico[]>(`${this.baseUrl}/dashboard/vendas-grafico?dias=${dias}`).pipe(
      catchError(() => {
        this.registrarFalha();
        return EMPTY;
      })
    );
  }

  getTopProducts(): Observable<TopProduto[]> {
    return this.http.get<TopProduto[]>(`${this.baseUrl}/dashboard/top-produtos`).pipe(
      catchError(() => { this.registrarFalha(); return EMPTY; })
    );
  }

  getDeliveryHeatmap(): Observable<MapaBairro[]> {
    return this.http.get<MapaBairro[]>(`${this.baseUrl}/dashboard/mapa-bairros`).pipe(
      catchError(() => { this.registrarFalha(); return EMPTY; })
    );
  }

  getPaymentMethods(): Observable<FormaPagamentoStat[]> {
    return this.http.get<FormaPagamentoStat[]>(`${this.baseUrl}/dashboard/formas-pagamento`).pipe(
      catchError(() => { this.registrarFalha(); return EMPTY; })
    );
  }

  getPedidos(status?: string, busca?: string): Observable<{ data: Pedido[] }> {
    let params: string[] = [];
    if (status) params.push(`status=${status}`);
    if (busca) params.push(`busca=${encodeURIComponent(busca)}`);
    const qs = params.length ? `?${params.join('&')}` : '';

    return this.http.get<{ data: Pedido[] }>(`${this.baseUrl}/pedidos${qs}`).pipe(
      catchError(() => { this.registrarFalha(); return EMPTY; })
    );
  }

  updatePedidoStatus(id: number, status: string): Observable<any> {
    return this.http.patch(`${this.baseUrl}/pedidos/${id}/status`, { status });
  }

  getClientes(busca?: string): Observable<{ data: Cliente[] }> {
    const qs = busca ? `?busca=${encodeURIComponent(busca)}` : '';
    return this.http.get<{ data: Cliente[] }>(`${this.baseUrl}/clientes${qs}`).pipe(
      catchError(() => { this.registrarFalha(); return EMPTY; })
    );
  }

  getCardapio(): Observable<CategoriaCardapio[]> {
    return this.http.get<CategoriaCardapio[]>(`${this.baseUrl}/cardapio`).pipe(
      catchError(() => { this.registrarFalha(); return EMPTY; })
    );
  }

  getCategoriasCardapio(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/cardapio/categorias`).pipe(
      catchError(() => { this.registrarFalha(); return EMPTY; })
    );
  }

  criarProduto(payload: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/cardapio/produtos`, payload);
  }

  atualizarProduto(id: number, payload: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/cardapio/produtos/${id}`, payload);
  }

  excluirProduto(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/cardapio/produtos/${id}`);
  }

  toggleProduto(id: number): Observable<any> {
    return this.http.patch(`${this.baseUrl}/cardapio/produtos/${id}/toggle`, {});
  }

  getAtendimentos(transbordo?: boolean): Observable<{ data: Atendimento[] }> {
    const qs = transbordo !== undefined ? `?transbordo=${transbordo}` : '';
    return this.http.get<{ data: Atendimento[] }>(`${this.baseUrl}/atendimentos${qs}`).pipe(
      catchError(() => { this.registrarFalha(); return EMPTY; })
    );
  }

  getStatusConversas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/status-conversa`).pipe(
      catchError(() => { this.registrarFalha(); return EMPTY; })
    );
  }
}

