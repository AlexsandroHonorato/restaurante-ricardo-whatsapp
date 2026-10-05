import { AuthService } from '../../core/services/auth.service';
import { Component, Input, Output, EventEmitter, inject, signal, OnDestroy } from '@angular/core';
import { TransbordosModalComponent } from './transbordos-modal.component';
import { AvisosSistemaComponent } from './avisos-sistema.component';
import { TransbordoService } from '../../core/services/transbordo.service';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, TransbordosModalComponent, AvisosSistemaComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent implements OnDestroy {
  @Input() menuAberto = true;
  @Output() alternarMenu = new EventEmitter<void>();
  api = inject(ApiService);
  auth = inject(AuthService);
  transbordo = inject(TransbordoService);
  private agora = signal(new Date());
  private relogio = setInterval(() => this.agora.set(new Date()), 60000);

  constructor() {
    this.transbordo.iniciar();
    this.api.getHorariosAtendimento().subscribe({ error: () => {} });
  }

  horarioHoje() {
    const dia = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'short',
    }).format(this.agora());
    const numero = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(dia) + 1;
    return this.api.horariosAtendimento()?.find((h) => h.dia_semana === numero);
  }

  aberto(): boolean {
    const horario = this.horarioHoje();
    if (!horario?.ativo || !horario.hora_inicio || !horario.hora_fim) return false;
    const hora = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(this.agora());
    return hora >= horario.hora_inicio.slice(0, 5) && hora < horario.hora_fim.slice(0, 5);
  }

  ngOnDestroy() {
    clearInterval(this.relogio);
  }

  sair() {
    this.auth.logout().subscribe({
      next: () => {
        window.location.assign('/login');
      },
      error: () => {
        this.api.erro.set('Não foi possível sair. Tente novamente.');
      },
    });
  }
  refresh() {
    this.api.getKpis().subscribe();
  }
}
