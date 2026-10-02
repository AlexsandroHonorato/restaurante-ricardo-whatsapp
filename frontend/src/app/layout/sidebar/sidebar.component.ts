import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <aside class="sidebar">
      <!-- Logo & Brand -->
      <div class="brand">
        <div class="brand-icon">🍽️</div>
        <div class="brand-text">
          <h2>Família Ricardo</h2>
          <span class="brand-badge">WhatsApp AI</span>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="nav-list">
        <div class="nav-section-title">PRINCIPAL</div>

        <a routerLink="/dashboard" routerLinkActive="active" class="nav-item">
          <span class="nav-icon">📊</span>
          <span class="nav-label">Dashboard Geral</span>
        </a>

        <a routerLink="/pedidos" routerLinkActive="active" class="nav-item">
          <span class="nav-icon">🛍️</span>
          <span class="nav-label">Pedidos & Cozinha</span>
          @if (api.kpis()?.pedidos_por_status?.em_preparo) {
            <span class="nav-pill prep">{{ api.kpis()?.pedidos_por_status?.em_preparo }}</span>
          }
        </a>

        <a routerLink="/atendimentos" routerLinkActive="active" class="nav-item">
          <span class="nav-icon">🤖</span>
          <span class="nav-label">Atendimentos IA</span>
          @if (api.kpis()?.total_transbordo_humano) {
            <span class="nav-pill alert">{{ api.kpis()?.total_transbordo_humano }}</span>
          }
        </a>

        <div class="nav-section-title">CADASTROS</div>

        <a routerLink="/clientes" routerLinkActive="active" class="nav-item">
          <span class="nav-icon">👥</span>
          <span class="nav-label">Clientes & LTV</span>
        </a>

        <a routerLink="/cardapio" routerLinkActive="active" class="nav-item">
          <span class="nav-icon">📋</span>
          <span class="nav-label">Cardápio & Preços</span>
        </a>
      </nav>

      <!-- Bot Status Card -->
      <div class="bot-card">
        <div class="bot-header">
          <span class="live-indicator"></span>
          <span class="bot-title">WhatsApp Bot Ativo</span>
        </div>
        <p class="bot-desc">Meta Cloud API conectada</p>
        <div class="bot-stat">
          <span>Taxa de Conversão:</span>
          <strong>{{ api.kpis()?.taxa_conversao_ia ?? 82.4 }}%</strong>
        </div>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar {
      width: 260px;
      background: var(--bg-surface);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      padding: 24px 16px;
      height: 100vh;
      position: sticky;
      top: 0;
      flex-shrink: 0;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 8px 24px;
      border-bottom: 1px solid var(--border-color);
      margin-bottom: 20px;
    }

    .brand-icon {
      font-size: 1.8rem;
      background: rgba(245, 158, 11, 0.15);
      border-radius: var(--radius-md);
      padding: 8px;
    }

    .brand-text h2 {
      font-size: 1.1rem;
      color: var(--text-primary);
      line-height: 1.2;
    }

    .brand-badge {
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .nav-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
    }

    .nav-section-title {
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--text-muted);
      letter-spacing: 0.08em;
      padding: 12px 12px 6px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      text-decoration: none;
      font-weight: 500;
      font-size: 0.9rem;
      transition: all var(--transition-fast);
      position: relative;
    }

    .nav-item:hover {
      background: rgba(255, 255, 255, 0.04);
      color: var(--text-primary);
    }

    .nav-item.active {
      background: rgba(245, 158, 11, 0.12);
      color: var(--primary);
      font-weight: 600;
    }

    .nav-item.active::before {
      content: '';
      position: absolute;
      left: 0;
      top: 8px;
      bottom: 8px;
      width: 4px;
      border-radius: 0 4px 4px 0;
      background: var(--primary);
    }

    .nav-icon {
      font-size: 1.15rem;
    }

    .nav-label {
      flex: 1;
    }

    .nav-pill {
      font-size: 0.725rem;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 9999px;
    }

    .nav-pill.prep {
      background: rgba(59, 130, 246, 0.2);
      color: #60A5FA;
    }

    .nav-pill.alert {
      background: rgba(239, 68, 68, 0.2);
      color: #F87171;
    }

    .bot-card {
      background: rgba(17, 24, 39, 0.8);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 14px;
      margin-top: auto;
    }

    .bot-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }

    .bot-title {
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .bot-desc {
      font-size: 0.725rem;
      color: var(--text-muted);
      margin-bottom: 8px;
    }

    .bot-stat {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      color: var(--text-secondary);
      border-top: 1px solid var(--border-color);
      padding-top: 8px;
    }

    .bot-stat strong {
      color: var(--success);
    }
  `]
})
export class SidebarComponent {
  api = inject(ApiService);
}
