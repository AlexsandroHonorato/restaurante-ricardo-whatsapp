import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { Pedido } from '../../core/models/dashboard.model';

@Component({
  selector: 'app-pedidos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pedidos-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Gestão de Pedidos & Cozinha</h1>
          <p class="page-subtitle">Acompanhe e despache pedidos em tempo real recebidos pelo WhatsApp</p>
        </div>

        <!-- Filtros de Status -->
        <div class="status-filters">
          <button class="filter-pill" [class.active]="filtroStatus() === ''" (click)="filtrarStatus('')">Todos</button>
          <button class="filter-pill pending" [class.active]="filtroStatus() === 'pendente'" (click)="filtrarStatus('pendente')">Pendentes</button>
          <button class="filter-pill prep" [class.active]="filtroStatus() === 'em_preparo'" (click)="filtrarStatus('em_preparo')">Na Cozinha</button>
          <button class="filter-pill delivery" [class.active]="filtroStatus() === 'saiu_para_entrega'" (click)="filtrarStatus('saiu_para_entrega')">Em Rota</button>
          <button class="filter-pill delivered" [class.active]="filtroStatus() === 'entregue'" (click)="filtrarStatus('entregue')">Entregues</button>
        </div>
      </div>

      <!-- Barra de Busca -->
      <div class="search-bar glass-card">
        <span class="search-icon">🔍</span>
        <input
          type="text"
          placeholder="Buscar por código do pedido (PED-...), nome do cliente ou telefone..."
          [(ngModel)]="termoBusca"
          (ngModelChange)="buscar()"
        />
      </div>

      <!-- Lista / Grid de Pedidos -->
      <div class="orders-grid">
        @for (pedido of pedidos(); track pedido.id) {
          <div class="glass-card order-card" [class.highlight]="pedido.status === 'em_preparo'">
            <div class="order-card-header">
              <div class="order-id-group">
                <span class="order-code">{{ pedido.codigo_pedido }}</span>
                <span class="order-time">{{ pedido.created_at | date:'HH:mm • dd/MM' }}</span>
              </div>
              <span class="badge" [ngClass]="getBadgeClass(pedido.status)">
                {{ formatStatus(pedido.status) }}
              </span>
            </div>

            <!-- Cliente & Endereço -->
            <div class="order-customer-box">
              <div class="cust-row">
                <strong>👤 {{ pedido.cliente?.nome || 'Cliente WhatsApp' }}</strong>
                <a [href]="'https://wa.me/' + pedido.cliente?.telefone" target="_blank" class="tel-link">
                  📱 {{ pedido.cliente?.telefone }}
                </a>
              </div>
              <div class="addr-text">
                📍 {{ pedido.endereco?.logradouro }}, {{ pedido.endereco?.numero }} — {{ pedido.endereco?.bairro }}
              </div>
            </div>

            <!-- Itens do Pedido -->
            <div class="order-items-list">
              @for (item of pedido.itens; track item.id) {
                <div class="order-item-row">
                  <div class="item-desc">
                    <span class="item-qty">{{ item.quantidade }}x</span>
                    <span class="item-name">{{ item.nome_snapshot }} ({{ item.tamanho_snapshot }})</span>
                  </div>
                  <span class="item-price">{{ item.subtotal | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
                </div>
              }
            </div>

            <!-- Pagamento e Total -->
            <div class="order-footer">
              <div class="pay-info">
                <span class="pay-method">💳 {{ pedido.forma_pagamento | uppercase }}</span>
                @if (pedido.troco_para) {
                  <span class="troco-info">Troco para: R$ {{ pedido.troco_para }}</span>
                }
              </div>
              <div class="total-info">
                <span class="total-label">Total</span>
                <span class="total-val">{{ pedido.valor_total | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
              </div>
            </div>

            <!-- Ações de Status da Cozinha -->
            <div class="order-actions">
              @if (pedido.status === 'pendente') {
                <button class="btn btn-primary btn-sm full" (click)="alterarStatus(pedido, 'em_preparo')">
                  👨‍🍳 Iniciar Preparo na Cozinha
                </button>
              }
              @if (pedido.status === 'em_preparo') {
                <button class="btn btn-success btn-sm full" (click)="alterarStatus(pedido, 'saiu_para_entrega')">
                  🛵 Despachar para Entrega
                </button>
              }
              @if (pedido.status === 'saiu_para_entrega') {
                <button class="btn btn-success btn-sm full" (click)="alterarStatus(pedido, 'entregue')">
                  ✅ Confirmar Entrega
                </button>
              }
              @if (pedido.status === 'entregue') {
                <span class="delivered-msg">🎉 Pedido Entregue com Sucesso</span>
              }
            </div>
          </div>
        } @empty {
          <div class="empty-state glass-card">
            <span class="empty-icon">📭</span>
            <h3>Nenhum pedido encontrado</h3>
            <p>Os novos pedidos recebidos no WhatsApp aparecerão aqui automaticamente.</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .pedidos-page {
      display: flex;
      flex-direction: column;
      gap: 20px;
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
      font-size: 1.6rem;
    }

    .page-subtitle {
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    .status-filters {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .filter-pill {
      background: var(--bg-surface-elevated);
      color: var(--text-secondary);
      border: 1px solid var(--border-color);
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .filter-pill.active {
      background: var(--primary);
      color: #111827;
      border-color: var(--primary);
    }

    .search-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 18px;
    }

    .search-icon {
      font-size: 1.1rem;
    }

    .search-bar input {
      flex: 1;
      background: transparent;
      border: none;
      color: var(--text-primary);
      font-size: 0.9rem;
      font-family: var(--font-body);
      outline: none;
    }

    .orders-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 20px;
    }

    .order-card {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .order-card.highlight {
      border-color: rgba(59, 130, 246, 0.4);
    }

    .order-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .order-id-group {
      display: flex;
      flex-direction: column;
    }

    .order-code {
      font-family: var(--font-heading);
      font-weight: 800;
      font-size: 1.05rem;
      color: var(--text-primary);
    }

    .order-time {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .order-customer-box {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .cust-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
    }

    .tel-link {
      color: #34D399;
      text-decoration: none;
      font-size: 0.775rem;
      font-weight: 600;
    }

    .addr-text {
      font-size: 0.775rem;
      color: var(--text-secondary);
    }

    .order-items-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 6px 0;
      border-top: 1px solid var(--border-color);
      border-bottom: 1px solid var(--border-color);
    }

    .order-item-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
    }

    .item-qty {
      font-weight: 700;
      color: var(--primary);
      margin-right: 6px;
    }

    .item-name {
      color: var(--text-primary);
    }

    .item-price {
      font-weight: 600;
      color: var(--text-secondary);
    }

    .order-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .pay-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .pay-method {
      font-size: 0.775rem;
      font-weight: 600;
      color: var(--text-muted);
    }

    .troco-info {
      font-size: 0.725rem;
      color: #FBBF24;
    }

    .total-info {
      text-align: right;
    }

    .total-label {
      font-size: 0.7rem;
      color: var(--text-muted);
      text-transform: uppercase;
      display: block;
    }

    .total-val {
      font-size: 1.25rem;
      font-weight: 800;
      color: #34D399;
    }

    .order-actions {
      display: flex;
      gap: 8px;
    }

    .full {
      width: 100%;
    }

    .delivered-msg {
      font-size: 0.8rem;
      color: #34D399;
      font-weight: 600;
      text-align: center;
      width: 100%;
      padding: 6px;
      background: rgba(16, 185, 129, 0.08);
      border-radius: var(--radius-sm);
    }

    .empty-state {
      grid-column: 1 / -1;
      text-align: center;
      padding: 60px 20px;
    }

    .empty-icon {
      font-size: 3rem;
      margin-bottom: 12px;
      display: block;
    }
  `]
})
export class PedidosComponent implements OnInit {
  api = inject(ApiService);
  pedidos = signal<Pedido[]>([]);
  filtroStatus = signal<string>('');
  termoBusca: string = '';

  ngOnInit() {
    this.carregarPedidos();
  }

  carregarPedidos() {
    this.api.getPedidos(this.filtroStatus(), this.termoBusca).subscribe((res) => {
      this.pedidos.set(res.data);
    });
  }

  filtrarStatus(status: string) {
    this.filtroStatus.set(status);
    this.carregarPedidos();
  }

  buscar() {
    this.carregarPedidos();
  }

  alterarStatus(pedido: Pedido, novoStatus: string) {
    this.api.updatePedidoStatus(pedido.id, novoStatus).subscribe(() => {
      this.carregarPedidos();
      this.api.getKpis().subscribe();
    });
  }

  formatStatus(status: string): string {
    const map: Record<string, string> = {
      pendente: 'Pendente',
      confirmado: 'Confirmado',
      em_preparo: 'Na Cozinha',
      saiu_para_entrega: 'Em Rota',
      entregue: 'Entregue',
      cancelado: 'Cancelado'
    };
    return map[status] || status;
  }

  getBadgeClass(status: string): string {
    const map: Record<string, string> = {
      pendente: 'badge-pending',
      confirmado: 'badge-pending',
      em_preparo: 'badge-prep',
      saiu_para_entrega: 'badge-delivery',
      entregue: 'badge-delivered',
      cancelado: 'badge-canceled'
    };
    return map[status] || 'badge-pending';
  }
}
