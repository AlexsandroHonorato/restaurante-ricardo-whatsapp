import { API_BASE } from './session-state';
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, tap, EMPTY, finalize } from 'rxjs';
import {
  AnalisesDashboard,
  DashboardKpis,
  VendaGrafico,
  TopProduto,
  MapaBairro,
  FormaPagamentoStat,
  Pedido,
  Cliente,
  CategoriaCardapio,
  Atendimento,
  HorarioAtendimento,
  HorariosAtendimentoResponse,
} from '../models/dashboard.model';

/** Resposta paginada do Laravel (paginate). */
export interface Paginado<T> {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
}

export interface ClienteSemResposta {
  telefone: string;
  quantidade: number;
  ultima_mensagem: string | null;
  ultima_em: string;
}

export interface PeriodoDashboard {
  inicio: string;
  fim: string;
}

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = API_BASE;

  horariosAtendimento = signal<HorarioAtendimento[] | null>(null);

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
      finalize(() => this.loading.set(false)),
    );
  }

  private queryPeriodo(dias: number, periodo?: PeriodoDashboard | null) {
    return periodo ? `data_inicio=${periodo.inicio}&data_fim=${periodo.fim}` : `dias=${dias}`;
  }

  getSalesChart(dias: number = 7, periodo?: PeriodoDashboard | null): Observable<VendaGrafico[]> {
    return this.http
      .get<VendaGrafico[]>(
        `${this.baseUrl}/dashboard/vendas-grafico?${this.queryPeriodo(dias, periodo)}`,
      )
      .pipe(
        catchError(() => {
          this.registrarFalha();
          return EMPTY;
        }),
      );
  }

  getAnalises(dias: number, periodo?: PeriodoDashboard | null): Observable<AnalisesDashboard> {
    return this.http.get<AnalisesDashboard>(
      `${this.baseUrl}/dashboard/analises?${this.queryPeriodo(dias, periodo)}`,
    );
  }

  getTopProducts(dias: number = 7, periodo?: PeriodoDashboard | null): Observable<TopProduto[]> {
    return this.http
      .get<TopProduto[]>(
        `${this.baseUrl}/dashboard/top-produtos?${this.queryPeriodo(dias, periodo)}`,
      )
      .pipe(
        catchError(() => {
          this.registrarFalha();
          return EMPTY;
        }),
      );
  }

  getDeliveryHeatmap(
    dias: number = 7,
    periodo?: PeriodoDashboard | null,
  ): Observable<MapaBairro[]> {
    return this.http
      .get<MapaBairro[]>(
        `${this.baseUrl}/dashboard/mapa-bairros?${this.queryPeriodo(dias, periodo)}`,
      )
      .pipe(
        catchError(() => {
          this.registrarFalha();
          return EMPTY;
        }),
      );
  }

  getPaymentMethods(
    dias: number = 7,
    periodo?: PeriodoDashboard | null,
  ): Observable<FormaPagamentoStat[]> {
    return this.http
      .get<FormaPagamentoStat[]>(
        `${this.baseUrl}/dashboard/formas-pagamento?${this.queryPeriodo(dias, periodo)}`,
      )
      .pipe(
        catchError(() => {
          this.registrarFalha();
          return EMPTY;
        }),
      );
  }

  getPedidosRecentes(): Observable<{ data: Pedido[] }> {
    return this.http.get<{ data: Pedido[] }>(`${this.baseUrl}/pedidos?per_page=5`);
  }

  /** Falhas chegam à tela, que mostra o erro na própria lista sem apagar o que já estava carregado. */
  getPedidos(status?: string, busca?: string, pagina = 1): Observable<Paginado<Pedido>> {
    let params: string[] = [`page=${pagina}`];
    if (status) params.push(`status=${status}`);
    if (busca) params.push(`busca=${encodeURIComponent(busca)}`);
    return this.http.get<Paginado<Pedido>>(`${this.baseUrl}/pedidos?${params.join('&')}`);
  }

  updatePedidoStatus(id: number, status: string, motivo_cancelamento?: string): Observable<any> {
    return this.http.patch(`${this.baseUrl}/pedidos/${id}/status`, { status, motivo_cancelamento });
  }

  /** LGPD: apaga os dados pessoais do cliente (somente administrador). */
  anonimizarCliente(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/clientes/${id}`);
  }

  getClientes(busca?: string, pagina = 1): Observable<Paginado<Cliente>> {
    const qs = busca ? `&busca=${encodeURIComponent(busca)}` : '';
    return this.http.get<Paginado<Cliente>>(`${this.baseUrl}/clientes?page=${pagina}${qs}`);
  }

  getCardapioConfiguracao(): Observable<CategoriaCardapio[]> {
    return this.http.get<CategoriaCardapio[]>(`${this.baseUrl}/cardapio`);
  }

  getCategoriasCardapio(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/cardapio/categorias`).pipe(
      catchError(() => {
        this.registrarFalha();
        return EMPTY;
      }),
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
      catchError(() => {
        this.registrarFalha();
        return EMPTY;
      }),
    );
  }

  iniciarContatoTransbordo(id: number): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.baseUrl}/status-conversa/${id}/contato`, {});
  }
  /** Clientes que escreveram com o bot fora do ar e ficaram sem resposta (últimas 24 h). */
  getClientesSemResposta(): Observable<ClienteSemResposta[]> {
    return this.http
      .get<ClienteSemResposta[]>(`${this.baseUrl}/conversas/sem-resposta`)
      .pipe(catchError(() => EMPTY));
  }
  /** A equipe viu o aviso e decidiu não chamar o cliente. */
  dispensarSemResposta(telefone: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(
      `${this.baseUrl}/conversas/${telefone}/sem-resposta`,
    );
  }
  /** Tira o cliente da fila de alertas (sem enviar mensagem); a conversa continua no monitor. */
  excluirAlertaTransbordo(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/status-conversa/${id}/alerta`);
  }
  /** Remove a conversa do monitor; mensagens, pedidos e cliente continuam gravados. */
  excluirConversa(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/status-conversa/${id}`);
  }
  /** Monitor: conversas do período (24, 168 ou 720 horas) + transbordos aguardando contato. */
  getStatusConversas(horas = 24): Observable<any[]> {
    const qs = horas === 24 ? '' : `?horas=${horas}`;
    return this.http.get<any[]>(`${this.baseUrl}/status-conversa${qs}`).pipe(
      catchError(() => {
        this.registrarFalha();
        return EMPTY;
      }),
    );
  }
  getHorariosAtendimento(): Observable<HorariosAtendimentoResponse> {
    return this.http
      .get<HorariosAtendimentoResponse>(`${this.baseUrl}/horarios-atendimento`)
      .pipe(tap((res) => this.horariosAtendimento.set(res.horarios)));
  }

  atualizarHorarioAtendimento(
    dia: number,
    dados: Pick<HorarioAtendimento, 'ativo' | 'hora_inicio' | 'hora_fim'>,
  ): Observable<{ horario: HorarioAtendimento }> {
    return this.http
      .put<{ horario: HorarioAtendimento }>(`${this.baseUrl}/horarios-atendimento/${dia}`, dados)
      .pipe(
        tap((res) =>
          this.horariosAtendimento.update(
            (horarios) => horarios?.map((h) => (h.dia_semana === dia ? res.horario : h)) ?? null,
          ),
        ),
      );
  }
}
