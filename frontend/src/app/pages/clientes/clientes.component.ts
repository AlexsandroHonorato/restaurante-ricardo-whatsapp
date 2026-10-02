import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { Cliente } from '../../core/models/dashboard.model';

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="clientes-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Clientes & Fidelidade (LTV)</h1>
          <p class="page-subtitle">Base de contatos, histórico de consumo e recorrência de clientes do WhatsApp</p>
        </div>
      </div>

      <!-- Barra de Busca -->
      <div class="search-bar glass-card">
        <span class="search-icon">🔍</span>
        <input
          type="text"
          placeholder="Buscar cliente por nome ou telefone..."
          [(ngModel)]="termoBusca"
          (ngModelChange)="buscar()"
        />
      </div>

      <!-- Tabela de Clientes -->
      <div class="table-container glass-card">
        <table class="data-table">
          <thead>
            <tr>
              <th>CLIENTE</th>
              <th>TELEFONE WHATSAPP</th>
              <th>BAIRRO / ENDEREÇO</th>
              <th>TOTAL PEDIDOS</th>
              <th>LTV (TOTAL GASTO)</th>
              <th>PRIMEIRO CONTATO</th>
              <th>AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            @for (c of clientes(); track c.id) {
              <tr>
                <td>
                  <div class="client-name-cell">
                    <div class="client-avatar">👤</div>
                    <strong>{{ c.nome || 'Cliente WhatsApp' }}</strong>
                  </div>
                </td>
                <td>
                  <a [href]="'https://wa.me/' + c.telefone" target="_blank" class="tel-btn">
                    💬 {{ c.telefone }}
                  </a>
                </td>
                <td>
                  <span class="addr-badge">
                    📍 {{ c.enderecos?.[0]?.bairro || 'Martim de Sá' }}
                  </span>
                </td>
                <td>
                  <span class="orders-count">{{ c.total_pedidos }} pedidos</span>
                </td>
                <td>
                  <strong class="ltv-value">{{ c.total_gasto | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</strong>
                </td>
                <td>
                  <span class="date-text">{{ c.primeiro_contato_em | date:'dd/MM/yyyy' }}</span>
                </td>
                <td>
                  <a [href]="'https://wa.me/' + c.telefone" target="_blank" class="btn btn-secondary btn-sm">
                    Abrir Conversa
                  </a>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="empty-cell">Nenhum cliente cadastrado no momento.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .clientes-page {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .page-title {
      font-size: 1.6rem;
    }

    .page-subtitle {
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    .search-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 18px;
    }

    .search-bar input {
      flex: 1;
      background: transparent;
      border: none;
      color: var(--text-primary);
      font-size: 0.9rem;
      outline: none;
    }

    .table-container {
      overflow-x: auto;
      padding: 8px;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    .data-table th {
      padding: 14px 16px;
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border-color);
      letter-spacing: 0.05em;
    }

    .data-table td {
      padding: 16px;
      font-size: 0.875rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.03);
      color: var(--text-secondary);
    }

    .client-name-cell {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--text-primary);
    }

    .client-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--bg-surface-elevated);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.9rem;
    }

    .tel-btn {
      color: #34D399;
      text-decoration: none;
      font-weight: 600;
    }

    .addr-badge {
      background: rgba(255, 255, 255, 0.04);
      padding: 4px 8px;
      border-radius: var(--radius-sm);
      font-size: 0.8rem;
    }

    .orders-count {
      font-weight: 600;
      color: var(--text-primary);
    }

    .ltv-value {
      color: #F59E0B;
      font-size: 0.95rem;
    }

    .date-text {
      color: var(--text-muted);
      font-size: 0.8rem;
    }

    .empty-cell {
      text-align: center;
      padding: 40px;
      color: var(--text-muted);
    }
  `]
})
export class ClientesComponent implements OnInit {
  api = inject(ApiService);
  clientes = signal<Cliente[]>([]);
  termoBusca: string = '';

  ngOnInit() {
    this.carregarClientes();
  }

  carregarClientes() {
    this.api.getClientes(this.termoBusca).subscribe((res) => {
      this.clientes.set(res.data);
    });
  }

  buscar() {
    this.carregarClientes();
  }
}
