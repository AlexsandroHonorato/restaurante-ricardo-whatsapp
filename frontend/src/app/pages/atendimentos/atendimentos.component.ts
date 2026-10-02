import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { Atendimento } from '../../core/models/dashboard.model';

@Component({
  selector: 'app-atendimentos',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="atendimentos-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Monitor de Atendimentos & Status da IA</h1>
          <p class="page-subtitle">Acompanhe as conversas em tempo real, estágios da máquina de estados e transbordo humano</p>
        </div>

        <div class="header-actions">
          <button class="refresh-btn glass-card" (click)="carregar()" title="Recarregar Dados">
            🔄 Atualizar Status
          </button>
          <div class="status-filters">
            <button class="filter-pill" [class.active]="filtroTransbordo() === undefined" (click)="filtrar(undefined)">Todas as Conversas</button>
            <button class="filter-pill alert" [class.active]="filtroTransbordo() === true" (click)="filtrar(true)">🔔 Transbordo Humano</button>
          </div>
        </div>
      </div>

      <!-- Feed de Conversas -->
      <div class="chat-feed-grid">
        @for (s of statusConversas(); track s.id) {
          <div class="glass-card chat-card" [class.alert-border]="s.status_atual === 'transbordo_humano'">
            <div class="chat-header">
              <div class="chat-user">
                <div class="avatar">💬</div>
                <div>
                  <strong>WhatsApp {{ s.telefone }}</strong>
                  <span class="chat-tel">Último contato: {{ s.ultimo_contato_em | date:'dd/MM • HH:mm:ss' }}</span>
                </div>
              </div>

              <span class="badge" [ngClass]="getBadgeClass(s.status_atual)">
                {{ formatStatusConversa(s.status_atual) }}
              </span>
            </div>

            <!-- Dados da Conversa -->
            <div class="chat-body">
              <div class="chat-metric">
                <span class="metric-lbl">Estágio Atual do Robô:</span>
                <strong class="stage-tag">{{ formatStatusConversa(s.status_atual) }}</strong>
              </div>

              @if (s.rascunho && temItensRascunho(s.rascunho)) {
                <div class="rascunho-box">
                  <span class="rascunho-title">🛒 Rascunho em Andamento:</span>
                  @if (s.rascunho.pratos?.length) {
                    <div class="rascunho-item">🍛 Pratos: {{ s.rascunho.pratos.join(', ') }}</div>
                  }
                  @if (s.rascunho.bebidas?.length) {
                    <div class="rascunho-item">🥤 Bebidas: {{ s.rascunho.bebidas.join(', ') }}</div>
                  }
                  @if (s.rascunho.endereco) {
                    <div class="rascunho-item">📍 Endereço: {{ s.rascunho.endereco }}</div>
                  }
                  @if (s.rascunho.formaPagamento) {
                    <div class="rascunho-item">💳 Pagamento: {{ s.rascunho.formaPagamento }}</div>
                  }
                </div>
              }

              <div class="chat-metric">
                <span class="metric-lbl">Expiração (30 min):</span>
                <span class="expire-time">{{ s.expira_em | date:'HH:mm:ss' }}</span>
              </div>
            </div>

            <!-- Botões de Ação -->
            <div class="chat-footer">
              <a [href]="'https://wa.me/' + s.telefone" target="_blank" class="btn btn-primary btn-sm full">
                📱 Abrir Conversa no WhatsApp
              </a>
            </div>
          </div>
        } @empty {
          <div class="empty-state glass-card">
            <span class="empty-icon">🤖</span>
            <h3>Nenhuma conversa ativa no momento</h3>
            <p>Assim que um cliente enviar uma mensagem no WhatsApp ou simulador, o status aparecerá aqui.</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .atendimentos-page {
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

    .status-filters {
      display: flex;
      gap: 8px;
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

    .filter-pill.alert.active {
      background: #EF4444;
      color: #FFFFFF;
      border-color: #EF4444;
    }

    .chat-feed-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 20px;
    }

    .chat-card {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      transition: transform var(--transition-fast);
    }

    .chat-card:hover {
      transform: translateY(-2px);
    }

    .chat-card.alert-border {
      border-color: rgba(239, 68, 68, 0.5);
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(17, 24, 39, 0.8));
    }

    .chat-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .chat-user {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: var(--bg-surface-elevated);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
      border: 1px solid var(--border-color);
    }

    .chat-tel {
      font-size: 0.775rem;
      color: var(--text-muted);
      display: block;
    }

    .chat-body {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px 0;
      border-top: 1px solid var(--border-color);
      border-bottom: 1px solid var(--border-color);
    }

    .chat-metric {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.85rem;
    }

    .metric-lbl {
      color: var(--text-secondary);
      font-size: 0.8rem;
    }

    .stage-tag {
      color: var(--primary);
      font-weight: 700;
      font-size: 0.85rem;
    }

    .expire-time {
      color: #FBBF24;
      font-size: 0.8rem;
      font-weight: 600;
    }

    .rascunho-box {
      background: rgba(255, 255, 255, 0.02);
      border: 1px dashed var(--border-color);
      border-radius: var(--radius-sm);
      padding: 8px 10px;
      font-size: 0.775rem;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .rascunho-title {
      font-weight: 700;
      color: var(--text-secondary);
      margin-bottom: 2px;
    }

    .rascunho-item {
      color: var(--text-primary);
    }

    .chat-footer {
      display: flex;
    }

    .full {
      width: 100%;
      text-align: center;
      text-decoration: none;
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
export class AtendimentosComponent implements OnInit {
  api = inject(ApiService);
  atendimentos = signal<Atendimento[]>([]);
  statusConversas = signal<any[]>([]);
  filtroTransbordo = signal<boolean | undefined>(undefined);

  ngOnInit() {
    this.carregar();
  }

  carregar() {
    this.api.getStatusConversas().subscribe((res) => {
      this.statusConversas.set(res);
    });
    this.api.getAtendimentos(this.filtroTransbordo()).subscribe((res) => {
      this.atendimentos.set(res.data);
    });
  }

  filtrar(transbordo?: boolean) {
    this.filtroTransbordo.set(transbordo);
    this.carregar();
  }

  temItensRascunho(rascunho: any): boolean {
    if (!rascunho) return false;
    return !!(rascunho.pratos?.length || rascunho.bebidas?.length || rascunho.endereco || rascunho.formaPagamento);
  }

  formatStatusConversa(status: string): string {
    const map: Record<string, string> = {
      conversa_iniciada: 'Iniciada / Menu',
      fazendo_pedido_pratos: 'Escolhendo Pratos',
      fazendo_pedido_bebidas: 'Escolhendo Bebidas',
      coletando_endereco: 'Coletando Endereço',
      coletando_pagamento: 'Definindo Pagamento',
      preparando_na_cozinha: 'Na Cozinha',
      saiu_para_entrega: 'Saiu p/ Entrega',
      cancelado_apos_30_minutos: 'Cancelado (30 min)',
      transbordo_humano: 'Transbordo Humano'
    };
    return map[status] || status;
  }

  getBadgeClass(status: string): string {
    const map: Record<string, string> = {
      conversa_iniciada: 'badge-pending',
      fazendo_pedido_pratos: 'badge-prep',
      fazendo_pedido_bebidas: 'badge-prep',
      coletando_endereco: 'badge-prep',
      coletando_pagamento: 'badge-prep',
      preparando_na_cozinha: 'badge-delivered',
      saiu_para_entrega: 'badge-delivery',
      cancelado_apos_30_minutos: 'badge-canceled',
      transbordo_humano: 'badge-canceled'
    };
    return map[status] || 'badge-pending';
  }
}
