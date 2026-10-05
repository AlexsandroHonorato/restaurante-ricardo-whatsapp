import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { API_BASE } from '../../core/services/session-state';
import { IconComponent } from '../../shared/ui/icon.component';

interface Problema {
  codigo: string;
  mensagem: string;
  /** O aviso tem uma lista de mensagens para a equipe conferir. */
  detalhes?: boolean;
}

interface MensagemAviso {
  id: number;
  direcao: 'entrada' | 'saida';
  telefone: string;
  texto: string | null;
  status: string;
  erro: string | null;
  created_at: string;
}

/** Faixa no topo do painel com o que precisa de ação agora (bot fora, token da Meta, mensagens sem envio). */
@Component({
  selector: 'app-avisos-sistema',
  imports: [IconComponent, DatePipe],
  template: `
    @if (problemas().length) {
      <div class="avisos" role="alert">
        <strong>Atenção — o atendimento pelo WhatsApp precisa de verificação:</strong>
        <ul>
          @for (p of problemas(); track p.codigo) {
            <li>
              {{ p.mensagem }}
              @if (p.detalhes) {
                <button
                  type="button"
                  class="ver"
                  (click)="abrir(p)"
                  title="Ver as mensagens"
                  [attr.aria-label]="'Ver as mensagens: ' + p.mensagem"
                >
                  <app-icon nome="buscar" />
                </button>
              }
            </li>
          }
        </ul>
      </div>
    }
    <dialog
      #dialog
      class="detalhes"
      aria-labelledby="avisos-detalhes-titulo"
      (click)="$event.target === dialog && fechar()"
    >
      <header>
        <h2 id="avisos-detalhes-titulo">{{ aberto()?.mensagem }}</h2>
        <button type="button" class="fechar" autofocus aria-label="Fechar" (click)="fechar()">
          <app-icon nome="fechar" />
        </button>
      </header>
      @if (carregando()) {
        <p class="estado" role="status">Carregando…</p>
      } @else if (erro()) {
        <p class="estado" role="alert">{{ erro() }}</p>
      } @else {
        <ul class="mensagens">
          @for (m of mensagens(); track m.id) {
            <li>
              <div class="info">
                <strong
                  >{{ m.direcao === 'saida' ? 'Para' : 'De' }} {{ m.telefone }} ·
                  {{ m.created_at | date: 'dd/MM HH:mm' }}</strong
                >
                <span class="texto">{{ m.texto || 'mensagem sem texto' }}</span>
                @if (m.erro) {
                  <small>Motivo: {{ m.erro }}</small>
                }
              </div>
              <button type="button" class="btn btn-primary btn-sm" (click)="conversa(m.telefone)">
                <app-icon nome="atendimentos" /> Abrir conversa
              </button>
            </li>
          } @empty {
            <li class="estado">Nenhuma mensagem neste aviso agora.</li>
          }
        </ul>
      }
    </dialog>
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
    .ver {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      margin-left: 6px;
      vertical-align: middle;
      border: 1px solid rgba(255, 255, 255, 0.45);
      border-radius: 7px;
      background: transparent;
      color: #fff;
      cursor: pointer;
    }
    .ver:hover {
      background: rgba(255, 255, 255, 0.15);
    }
    .ver app-icon {
      transform: scale(0.8);
    }
    .detalhes {
      position: fixed;
      inset: 0;
      margin: auto;
      width: min(560px, calc(100vw - var(--ds-space-8)));
      max-height: calc(100dvh - var(--ds-space-8));
      padding: 0;
      border: 1px solid var(--border-highlight);
      border-radius: var(--radius-lg);
      background: var(--bg-surface);
      color: var(--text-primary);
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
    }
    .detalhes[open] {
      display: flex;
      flex-direction: column;
    }
    .detalhes::backdrop {
      background: rgba(9, 13, 24, 0.75);
      backdrop-filter: blur(4px);
    }
    header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding: 18px 20px;
      border-bottom: 1px solid var(--border-color);
    }
    h2 {
      margin: 0;
      font-size: 1rem;
    }
    .fechar {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      flex-shrink: 0;
      border: 1px solid var(--border-color);
      border-radius: 9px;
      background: var(--bg-surface-elevated);
      color: var(--text-secondary);
      cursor: pointer;
    }
    .mensagens {
      list-style: none;
      margin: 0;
      padding: 8px 20px 20px;
      min-height: 0;
      overflow-y: auto;
    }
    .mensagens li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px 16px;
      padding: 12px 0;
      border-bottom: 1px solid var(--border-color);
    }
    .mensagens li:last-child {
      border-bottom: 0;
    }
    .info {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
      flex: 1 1 260px;
      overflow-wrap: anywhere;
      font-size: 0.85rem;
    }
    .texto {
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      color: var(--text-secondary);
      white-space: pre-wrap;
    }
    small {
      color: var(--warning);
    }
    .estado {
      margin: 0;
      padding: 20px;
      color: var(--text-muted);
      font-size: 0.85rem;
    }
    button:focus-visible {
      outline: 2px solid var(--primary-text);
      outline-offset: 3px;
    }
  `,
})
export class AvisosSistemaComponent {
  private http = inject(HttpClient);
  private router = inject(Router);
  private dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  problemas = signal<Problema[]>([]);
  aberto = signal<Problema | null>(null);
  mensagens = signal<MensagemAviso[]>([]);
  carregando = signal(false);
  erro = signal('');

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

  /** Lista as mensagens do aviso (uma ou várias) para a equipe abrir a conversa de cada uma. */
  abrir(problema: Problema) {
    this.aberto.set(problema);
    this.mensagens.set([]);
    this.erro.set('');
    this.carregando.set(true);
    this.dialog().nativeElement.showModal();
    this.http.get<MensagemAviso[]>(`${API_BASE}/sistema/saude/${problema.codigo}`).subscribe({
      next: (lista) => {
        this.mensagens.set(lista);
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set('Não foi possível carregar as mensagens. Tente novamente.');
        this.carregando.set(false);
      },
    });
  }

  fechar() {
    this.dialog().nativeElement.close();
  }

  conversa(telefone: string) {
    this.fechar();
    this.router.navigate(['/atendimentos'], { queryParams: { conversa: telefone } });
  }
}
