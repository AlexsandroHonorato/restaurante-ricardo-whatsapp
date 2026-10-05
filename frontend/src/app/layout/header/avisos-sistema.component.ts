import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmacaoService } from '../../shared/ui/confirmacao.service';
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
        @if (podeDispensar() && mensagens().length > 1) {
          <div class="barra">
            <span>{{ mensagens().length }} mensagens</span>
            <button type="button" class="btn btn-secondary btn-sm todas" (click)="excluirTodas()">
              <app-icon nome="excluir" /> Excluir todas
            </button>
          </div>
        }
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
              <div class="acoes-linha">
                <button type="button" class="btn btn-primary btn-sm" (click)="conversa(m.telefone)">
                  <app-icon nome="atendimentos" /> Abrir conversa
                </button>
                @if (podeDispensar()) {
                  <button
                    type="button"
                    class="excluir"
                    [disabled]="excluindo().has(m.id)"
                    (click)="excluir(m)"
                    title="Excluir do aviso"
                    [attr.aria-label]="'Excluir do aviso a mensagem de ' + m.telefone"
                  >
                    <app-icon nome="excluir" />
                  </button>
                }
              </div>
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
    .barra {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 20px 0;
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    .acoes-linha {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    .excluir {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
    }
    .excluir:hover:not(:disabled) {
      color: var(--danger);
      border-color: var(--danger);
      background: var(--danger-glow);
    }
    .excluir:disabled {
      opacity: 0.4;
      cursor: not-allowed;
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
  private auth = inject(AuthService);
  private confirmacao = inject(ConfirmacaoService);
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

  /** Dispensar mensagens de um aviso conta como "editar" em Atendimentos (a API confere). */
  podeDispensar = computed(() => this.auth.pode('atendimentos', 'editar'));
  excluindo = signal(new Set<number>());

  /** Tira a mensagem do aviso: a equipe viu e decidiu não agir. A mensagem continua no histórico da conversa. */
  excluir(m: MensagemAviso) {
    const aviso = this.aberto();
    if (!aviso || this.excluindo().has(m.id)) return;
    this.confirmacao.pedir(
      {
        titulo: 'Excluir do aviso?',
        mensagem: `A mensagem de ${m.telefone} sai deste aviso para toda a equipe. Ela continua no histórico da conversa.`,
        confirmar: 'Excluir',
        perigo: true,
      },
      () => this.dispensar(aviso, [m.id], `${API_BASE}/sistema/saude/${aviso.codigo}/${m.id}`),
    );
  }

  excluirTodas() {
    const aviso = this.aberto();
    const ids = this.mensagens().map((m) => m.id);
    if (!aviso || !ids.length) return;
    this.confirmacao.pedir(
      {
        titulo: 'Excluir todas do aviso?',
        mensagem: `As ${ids.length} mensagens saem deste aviso para toda a equipe. Elas continuam no histórico das conversas.`,
        confirmar: 'Excluir todas',
        perigo: true,
      },
      () => this.dispensar(aviso, ids, `${API_BASE}/sistema/saude/${aviso.codigo}`),
    );
  }

  private dispensar(aviso: Problema, ids: number[], url: string) {
    this.excluindo.update((atuais) => new Set([...atuais, ...ids]));
    this.erro.set('');
    this.http.delete(url).subscribe({
      next: () => {
        this.mensagens.update((lista) => lista.filter((m) => !ids.includes(m.id)));
        this.excluindo.update((atuais) => new Set([...atuais].filter((id) => !ids.includes(id))));
        this.consultar();
        if (!this.mensagens().length) this.fechar();
      },
      error: () => {
        this.excluindo.update((atuais) => new Set([...atuais].filter((id) => !ids.includes(id))));
        this.erro.set('Não foi possível excluir do aviso. Tente novamente.');
      },
    });
  }

  conversa(telefone: string) {
    this.fechar();
    this.router.navigate(['/atendimentos'], { queryParams: { conversa: telefone } });
  }
}
