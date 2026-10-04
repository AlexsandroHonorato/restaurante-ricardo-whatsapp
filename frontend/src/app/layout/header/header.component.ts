import { Component, Input, Output, EventEmitter, inject, signal, OnDestroy } from '@angular/core';
import { TransbordosModalComponent } from './transbordos-modal.component';
import { TransbordoService } from '../../core/services/transbordo.service';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, TransbordosModalComponent],
  template: `
    @if (api.erro()) {
      <div role="alert" style="padding: 10px 20px; background: #7f1d1d; color: white">{{ api.erro() }}</div>
    }
    <header class="header">
      <div class="header-left">
        <button class="menu-toggle btn btn-secondary" [class.menu-girado]="!menuAberto" type="button" (click)="alternarMenu.emit()" [attr.aria-label]="menuAberto ? 'Esconder menu' : 'Mostrar menu'" [attr.aria-expanded]="menuAberto" aria-controls="menu-principal">
          <svg class="hamburguer-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
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
        <button class="btn refresh-dados" (click)="refresh()" [disabled]="api.loading()" [class.carregando]="api.loading()" [attr.aria-busy]="api.loading()">
          <svg class="refresh-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 2M4 16l2 2a7 7 0 0 0 12-1"/></svg>
          <span>{{ api.loading() ? 'Atualizando...' : 'Atualizar Dados' }}</span>
        </button>

        <button type="button" class="transbordo-bell" (click)="transbordosModal.abrir($event.currentTarget)" aria-haspopup="dialog"
          [class.com-pendencias]="transbordo.aguardando() > 0"
          [attr.aria-label]="'Atendimento humano: ' + transbordo.aguardando() + ' cliente(s) aguardando'"
          title="Ver clientes aguardando atendente">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4"/></svg>
          @if (transbordo.aguardando()) { <span class="bell-counter">{{ transbordo.aguardando() > 99 ? '99+' : transbordo.aguardando() }}</span> }
        </button>
        <app-transbordos-modal #transbordosModal/>
        <span class="bell-announcement" role="status" aria-live="polite">{{ transbordo.eventos() ? 'Novo pedido de atendimento humano. ' + transbordo.aguardando() + ' cliente(s) aguardando.' : '' }}</span>
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
    .transbordo-bell{position:relative;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:42px;height:42px;border-radius:12px;color:var(--text-secondary);background:transparent;border:0;padding:0;cursor:pointer;text-decoration:none}
    .transbordo-bell:hover,.transbordo-bell.com-pendencias{color:var(--primary-text)}
    .transbordo-bell:focus-visible{outline:2px solid var(--primary-text);outline-offset:3px}
    .bell-counter{position:absolute;top:-6px;right:-6px;min-width:19px;height:19px;padding:0 4px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:var(--primary);color:var(--on-primary);font-size:.65rem;font-weight:700;border:2px solid var(--bg-surface)}
    .transbordo-bell.com-pendencias svg{transform-origin:50% 15%;animation:bell-ring 2.8s ease-in-out infinite}

    @keyframes bell-ring{0%,40%,100%{transform:rotate(0)}5%,15%,25%{transform:rotate(20deg)}10%,20%,30%{transform:rotate(-20deg)}35%{transform:rotate(8deg)}}

    .bell-announcement{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
    @media(prefers-reduced-motion:reduce){.transbordo-bell.com-pendencias svg{animation:none}}
    .refresh-dados { background:var(--primary);color:var(--on-primary);border:1px solid transparent;gap:8px;padding:10px 16px;border-radius:10px;box-shadow:0 4px 12px var(--primary-glow);white-space:nowrap; }
    .refresh-dados:hover:not(:disabled){background:var(--primary-hover);transform:translateY(-1px)}
    .refresh-dados:active:not(:disabled){transform:translateY(0)}
    .refresh-dados:disabled{cursor:wait;opacity:.7}
    .carregando .refresh-icon{animation:refresh-giro .8s linear infinite}
    @keyframes refresh-giro{to{transform:rotate(360deg)}}
    @media(prefers-reduced-motion:reduce){.refresh-icon{animation:none!important}}
    .menu-toggle { padding: 10px; flex-shrink: 0; margin-right: 14px; }
    .hamburguer-icon { display: block; transform: rotate(0deg); transition: transform .65s cubic-bezier(.4,0,.2,1); }
    .menu-girado .hamburguer-icon { transform: rotate(360deg); }
    @media (prefers-reduced-motion: reduce) { .hamburguer-icon { transition: none; } }
    .status-badge.closed .live-indicator {background:var(--danger);box-shadow:none;animation:none;}
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
  @Input() menuAberto = true;
  @Output() alternarMenu = new EventEmitter<void>();
  api = inject(ApiService);
  transbordo = inject(TransbordoService);
  private agora = signal(new Date());
  private relogio = setInterval(() => this.agora.set(new Date()), 60000);

  constructor() {
    this.transbordo.iniciar();
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
