import { Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE } from '../../core/services/session-state';

interface Problema {
  codigo: string;
  mensagem: string;
}

/** Faixa no topo do painel com o que precisa de ação agora (bot fora, token da Meta, mensagens sem envio). */
@Component({
  selector: 'app-avisos-sistema',
  template: `
    @if (problemas().length) {
      <div class="avisos" role="alert">
        <strong>Atenção — o atendimento pelo WhatsApp precisa de verificação:</strong>
        <ul>
          @for (p of problemas(); track p.codigo) {
            <li>{{ p.mensagem }}</li>
          }
        </ul>
      </div>
    }
  `,
  styles: `
    .avisos {
      padding: 10px 24px;
      background: #7f1d1d;
      color: #fff;
      font-size: 0.85rem;
    }
    ul {
      margin: 4px 0 0 18px;
    }
  `,
})
export class AvisosSistemaComponent {
  private http = inject(HttpClient);
  problemas = signal<Problema[]>([]);

  constructor() {
    this.consultar();
    const timer = setInterval(() => this.consultar(), 60000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  private consultar() {
    // Falha de rede já aparece no aviso geral de conexão; aqui não inventamos problema.
    this.http.get<{ problemas: Problema[] }>(`${API_BASE}/sistema/saude`).subscribe({
      next: (r) => this.problemas.set(r.problemas ?? []),
      error: () => {},
    });
  }
}
