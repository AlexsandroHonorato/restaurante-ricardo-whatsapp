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
            {{ api.horariosAtendimento() ? (aberto() ? 'Restaurante Aberto' : 'Restaurante Fechado') : 'Consultando agenda' }} • Caraguatatuba/SP
          </span>
          <span class="hours">{{ horarioHoje()?.ativo ? 'Hoje: ' + horarioHoje()?.hora_inicio?.slice(0, 5) + ' às ' + horarioHoje()?.hora_fim?.slice(0, 5) : (api.horariosAtendimento() ? 'Hoje sem atendimento' : 'Horários em Configurações') }}</span>
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
    @media (max-width: 768px) {
      .header { height: auto; padding: 14px 16px; flex-wrap: wrap; gap: 12px; }
      .store-status { flex-direction: column; align-items: flex-start; gap: 6px; }
      .status-badge { font-size: .72rem; padding: 6px 10px; }
      .user-pill, .header-meta { display: none; }
      .header-right { margin-left: auto; }
    }
  `]
})
export class HeaderComponent implements OnDestroy {
  api = inject(ApiService);
  private agora = signal(new Date());
  private relogio = setInterval(() => this.agora.set(new Date()), 60000);

  constructor() {
    this.api.getHorariosAtendimento().subscribe({ error: () => {} });
  }

  horarioHoje() {
    const dia = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(this.agora());
    const numero = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(dia) + 1;
    return this.api.horariosAtendimento()?.find(h => h.dia_semana === numero);
  }

  aberto(): boolean {
    const horario = this.horarioHoje();
    if (!horario?.ativo || !horario.hora_inicio || !horario.hora_fim) return false;
    const hora = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).format(this.agora());
    return hora >= horario.hora_inicio.slice(0, 5) && hora < horario.hora_fim.slice(0, 5);
  }

  ngOnDestroy() { clearInterval(this.relogio); }


  refresh() {
    this.api.getKpis().subscribe();
  }
}
