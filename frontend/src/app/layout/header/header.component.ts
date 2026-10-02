import { Component, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (api.erro()) {
      <div role="alert" style="padding: 10px 20px; background: #7f1d1d; color: white">{{ api.erro() }}</div>
    }
    <header class="header">
      <div class="header-left">
        <div class="store-status">
          <span class="status-badge" [class.open]="aberto()" [class.closed]="!aberto()">
            <span class="live-indicator"></span>
            Restaurante {{ aberto() ? 'Aberto' : 'Fechado' }} • Caraguatatuba/SP
          </span>
          <span class="hours">Segunda a Sábado, 11h00 às 14h30</span>
        </div>
      </div>

      <div class="header-right">
        <!-- Atualizar Dados -->
        <button class="btn btn-secondary btn-sm" (click)="refresh()" [disabled]="api.loading()">
          <span>🔄</span>
          <span>{{ api.loading() ? 'Atualizando...' : 'Atualizar Dados' }}</span>
        </button>

        <!-- Quick Info -->
        <div class="header-meta">
          <span class="meta-label">Última atualização:</span>
          <span class="meta-value">{{ api.lastUpdated() | date:'HH:mm:ss' }}</span>
        </div>

        <!-- User Profile Avatar -->
        <div class="user-pill">
          <div class="user-avatar">👨‍🍳</div>
          <div class="user-info">
            <span class="user-name">Família Ricardo</span>
            <span class="user-role">Administrador</span>
          </div>
        </div>
      </div>
    </header>
  `,
  styles: [`
    .header {
      height: 70px;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 32px;
      position: sticky;
      top: 0;
      z-index: 50;
    }

    .header-left {
      display: flex;
      align-items: center;
    }

    .store-status {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #34D399;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
    }

    .status-badge.closed { background: rgba(239, 68, 68, .12); border-color: #ef4444; color: #fca5a5; }

    .hours {
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .header-meta {
      font-size: 0.775rem;
      display: flex;
      flex-direction: column;
      text-align: right;
    }

    .meta-label {
      color: var(--text-muted);
    }

    .meta-value {
      color: var(--text-secondary);
      font-weight: 600;
    }

    .user-pill {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 12px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
    }

    .user-avatar {
      font-size: 1.2rem;
      background: var(--bg-surface-elevated);
      border-radius: 50%;
      padding: 4px;
    }

    .user-info {
      display: flex;
      flex-direction: column;
    }

    .user-name {
      font-size: 0.825rem;
      font-weight: 600;
      color: var(--text-primary);
      line-height: 1.2;
    }

    .user-role {
      font-size: 0.7rem;
      color: var(--text-muted);
    }
  `]
})
export class HeaderComponent implements OnDestroy {
  api = inject(ApiService);
  private agora = signal(new Date());
  private relogio = setInterval(() => this.agora.set(new Date()), 60000);

  aberto(): boolean {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(this.agora());
    const valor = (tipo: string) => partes.find(p => p.type === tipo)?.value || '';
    const minutos = Number(valor('hour')) * 60 + Number(valor('minute'));
    return valor('weekday') !== 'Sun' && minutos >= 660 && minutos < 870;
  }

  ngOnDestroy() { clearInterval(this.relogio); }


  refresh() {
    this.api.getKpis().subscribe();
  }
}
