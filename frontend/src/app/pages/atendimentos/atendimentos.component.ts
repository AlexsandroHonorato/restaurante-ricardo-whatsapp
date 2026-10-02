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
          <!-- Toggle de Visão (Cards vs Lista) -->
          <div class="view-toggle glass-card">
            <button
              class="view-btn"
              [class.active]="modoVisao() === 'cards'"
              (click)="alternarVisao('cards')"
              title="Visualização em Cards"
            >
              <span class="btn-icon">🗂️</span> Cards
            </button>
            <button
              class="view-btn"
              [class.active]="modoVisao() === 'lista'"
              (click)="alternarVisao('lista')"
              title="Visualização em Tabela/Lista"
            >
              <span class="btn-icon">📋</span> Lista
            </button>
          </div>

          <button class="refresh-btn glass-card" (click)="carregar()" title="Recarregar Dados">
            🔄 Atualizar Status
          </button>
          <div class="status-filters">
            <button class="filter-pill" [class.active]="filtroTransbordo() === undefined" (click)="filtrar(undefined)">Todas as Conversas</button>
            <button class="filter-pill alert" [class.active]="filtroTransbordo() === true" (click)="filtrar(true)">🔔 Transbordo Humano</button>
          </div>
        </div>
      </div>

      <!-- 1. VISÃO EM CARDS (FEED DE CONVERSAS) -->
      @if (modoVisao() === 'cards') {
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
      }

      <!-- 2. VISÃO EM LISTA (TABELA DETALHADA) -->
      @if (modoVisao() === 'lista') {
        <div class="table-container glass-card">
          <table class="data-table">
            <thead>
              <tr>
                <th>Telefone / WhatsApp</th>
                <th>Último Contato</th>
                <th>Estágio da IA</th>
                <th>Rascunho / Conteúdo em Aberto</th>
                <th>Expira em (30m)</th>
                <th>Ação Rápida</th>
              </tr>
            </thead>
            <tbody>
              @for (s of statusConversas(); track s.id) {
                <tr [class.alert-row]="s.status_atual === 'transbordo_humano'">
                  <td class="client-cell">
                    <div class="tel-wrapper">
                      <span class="avatar-mini">💬</span>
                      <div>
                        <strong class="tel-number">{{ s.telefone }}</strong>
                      </div>
                    </div>
                  </td>
                  <td class="time-cell">
                    {{ s.ultimo_contato_em | date:'HH:mm:ss • dd/MM' }}
                  </td>
                  <td>
                    <span class="badge" [ngClass]="getBadgeClass(s.status_atual)">
                      {{ formatStatusConversa(s.status_atual) }}
                    </span>
                  </td>
                  <td>
                    @if (s.rascunho && temItensRascunho(s.rascunho)) {
                      <div class="rascunho-inline-list">
                        @if (s.rascunho.pratos?.length) {
                          <span class="tag-chip pratos" title="Pratos">🍛 {{ s.rascunho.pratos.join(', ') }}</span>
                        }
                        @if (s.rascunho.bebidas?.length) {
                          <span class="tag-chip bebidas" title="Bebidas">🥤 {{ s.rascunho.bebidas.join(', ') }}</span>
                        }
                        @if (s.rascunho.endereco) {
                          <span class="tag-chip endereco" title="Endereço">📍 {{ s.rascunho.endereco }}</span>
                        }
                        @if (s.rascunho.formaPagamento) {
                          <span class="tag-chip pagamento" title="Pagamento">💳 {{ s.rascunho.formaPagamento }}</span>
                        }
                      </div>
                    } @else {
                      <span class="text-muted-sm">Sem rascunho ativo</span>
                    }
                  </td>
                  <td class="time-cell">
                    <span class="expire-badge">{{ s.expira_em | date:'HH:mm:ss' }}</span>
                  </td>
                  <td>
                    <a [href]="'https://wa.me/' + s.telefone" target="_blank" class="btn btn-primary btn-xs flex-btn">
                      📱 Abrir WhatsApp
                    </a>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="empty-table-cell">
                    <div class="empty-state-mini">
                      <span>🤖</span>
                      <p>Nenhuma conversa ativa no momento.</p>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
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

    /* Toggle de Visão */
    .view-toggle {
      display: flex;
      padding: 3px;
      gap: 4px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-color);
      background: var(--bg-surface-elevated);
    }

    .view-btn {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      padding: 6px 12px;
      border-radius: calc(var(--radius-sm) - 2px);
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all var(--transition-fast);
    }

    .view-btn:hover {
      color: var(--text-primary);
      background: rgba(255, 255, 255, 0.05);
    }

    .view-btn.active {
      background: var(--primary);
      color: #111827;
      font-weight: 700;
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

    /* GRID DE CARDS */
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

    /* VISÃO EM TABELA / LISTA */
    .table-container {
      overflow-x: auto;
      border-radius: var(--radius-md);
      padding: 0;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    .data-table th {
      background: rgba(255, 255, 255, 0.03);
      padding: 14px 16px;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border-color);
    }

    .data-table td {
      padding: 14px 16px;
      border-bottom: 1px solid var(--border-color);
      font-size: 0.85rem;
      vertical-align: middle;
    }

    .data-table tr:hover {
      background: rgba(255, 255, 255, 0.02);
    }

    .data-table tr.alert-row {
      background: rgba(239, 68, 68, 0.06);
    }

    .tel-wrapper {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .avatar-mini {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--bg-surface-elevated);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.9rem;
      border: 1px solid var(--border-color);
    }

    .tel-number {
      font-weight: 600;
      color: var(--text-primary);
    }

    .time-cell {
      color: var(--text-secondary);
      font-size: 0.8rem;
      white-space: nowrap;
    }

    .rascunho-inline-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .tag-chip {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      max-width: 260px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .tag-chip.pratos {
      border-color: rgba(245, 158, 11, 0.3);
      color: #FCD34D;
    }

    .tag-chip.bebidas {
      border-color: rgba(59, 130, 246, 0.3);
      color: #93C5FD;
    }

    .tag-chip.endereco {
      border-color: rgba(16, 185, 129, 0.3);
      color: #6EE7B7;
    }

    .tag-chip.pagamento {
      border-color: rgba(139, 92, 246, 0.3);
      color: #C4B5FD;
    }

    .text-muted-sm {
      color: var(--text-muted);
      font-size: 0.775rem;
      font-style: italic;
    }

    .expire-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      background: rgba(251, 191, 36, 0.1);
      color: #FBBF24;
      font-weight: 600;
      font-size: 0.8rem;
      border: 1px solid rgba(251, 191, 36, 0.3);
    }

    .flex-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
      white-space: nowrap;
    }

    .empty-table-cell {
      text-align: center;
      padding: 40px !important;
    }

    .empty-state-mini {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      color: var(--text-muted);
      font-size: 0.9rem;
    }

    .empty-state-mini span {
      font-size: 2rem;
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
  modoVisao = signal<'cards' | 'lista'>('cards');

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

  alternarVisao(modo: 'cards' | 'lista') {
    this.modoVisao.set(modo);
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
