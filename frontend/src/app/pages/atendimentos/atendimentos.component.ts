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
          <h1 class="page-title">Monitor de Atendimentos da IA</h1>
          <p class="page-subtitle">Acompanhe as conversas em tempo real, transbordo para atendentes e conversão de pedidos</p>
        </div>

        <div class="status-filters">
          <button class="filter-pill" [class.active]="filtroTransbordo() === undefined" (click)="filtrar(undefined)">Todas as Conversas</button>
          <button class="filter-pill alert" [class.active]="filtroTransbordo() === true" (click)="filtrar(true)">🔔 Transbordo Humano</button>
        </div>
      </div>

      <!-- Feed de Conversas -->
      <div class="chat-feed-grid">
        @for (a of atendimentos(); track a.id) {
          <div class="glass-card chat-card" [class.alert-border]="a.transbordo_humano">
            <div class="chat-header">
              <div class="chat-user">
                <div class="avatar">💬</div>
                <div>
                  <strong>{{ a.cliente?.nome || 'Cliente WhatsApp' }}</strong>
                  <span class="chat-tel">{{ a.cliente?.telefone }}</span>
                </div>
              </div>

              @if (a.transbordo_humano) {
                <span class="badge badge-canceled">🔔 Transbordo Solicitado</span>
              } @else if (a.status === 'finalizado_com_pedido') {
                <span class="badge badge-delivered">🛍️ Pedido Fechado</span>
              } @else {
                <span class="badge badge-pending">Atendimento em Curso</span>
              }
            </div>

            <!-- Dados da Conversa -->
            <div class="chat-body">
              <div class="chat-metric">
                <span class="metric-lbl">Mensagens Trocadas:</span>
                <strong>{{ a.total_mensagens_cliente }} cliente / {{ a.total_mensagens_bot }} robô</strong>
              </div>

              <div class="chat-metric">
                <span class="metric-lbl">Início:</span>
                <span>{{ a.inicio_em | date:'dd/MM • HH:mm:ss' }}</span>
              </div>

              @if (a.motivo_transbordo) {
                <div class="alert-box">
                  <strong>Motivo da Transferência:</strong> {{ a.motivo_transbordo }}
                </div>
              }
            </div>

            <!-- Botões de Ação -->
            <div class="chat-footer">
              <a [href]="'https://wa.me/' + a.cliente?.telefone" target="_blank" class="btn btn-primary btn-sm full">
                📱 Abrir WhatsApp do Cliente
              </a>
            </div>
          </div>
        } @empty {
          <div class="empty-state glass-card">
            <span class="empty-icon">🤖</span>
            <h3>Nenhum atendimento com esses filtros</h3>
            <p>O robô do WhatsApp está pronto para atender novas conversas.</p>
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
    }

    .filter-pill.alert.active {
      background: #EF4444;
      color: #FFFFFF;
      border-color: #EF4444;
    }

    .chat-feed-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 20px;
    }

    .chat-card {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
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
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--bg-surface-elevated);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
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
      padding: 8px 0;
      border-top: 1px solid var(--border-color);
      border-bottom: 1px solid var(--border-color);
      font-size: 0.85rem;
    }

    .chat-metric {
      display: flex;
      justify-content: space-between;
      color: var(--text-secondary);
    }

    .alert-box {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #FCA5A5;
      padding: 8px 10px;
      border-radius: var(--radius-sm);
      font-size: 0.8rem;
    }

    .full {
      width: 100%;
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
  filtroTransbordo = signal<boolean | undefined>(undefined);

  ngOnInit() {
    this.carregarAtendimentos();
  }

  carregarAtendimentos() {
    this.api.getAtendimentos(this.filtroTransbordo()).subscribe((res) => {
      this.atendimentos.set(res.data);
    });
  }

  filtrar(transbordo?: boolean) {
    this.filtroTransbordo.set(transbordo);
    this.carregarAtendimentos();
  }
}
