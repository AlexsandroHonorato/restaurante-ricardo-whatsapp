import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  afterRenderEffect,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { API_BASE } from '../../core/services/session-state';
import { AuthService } from '../../core/services/auth.service';

interface MensagemConversa {
  id: number;
  direcao: 'entrada' | 'saida';
  texto: string;
  status: string;
  enviada_por: string | null;
  created_at: string;
}

/**
 * Atendimento humano dentro do painel: histórico da conversa (gravado pelo bot), resposta da equipe
 * e pausa do bot. Responder pausa o bot nesta conversa por 2 horas; "Devolver ao bot" retoma na hora.
 */
@Component({
  selector: 'app-conversa-painel',
  imports: [FormsModule, DatePipe],
  templateUrl: './conversa-painel.component.html',
  styleUrl: './conversa-painel.component.css',
})
export class ConversaPainelComponent implements OnInit {
  private http = inject(HttpClient);
  /** Perfil sem "editar" em Atendimentos lê a conversa, mas não responde nem pausa o bot. */
  private auth = inject(AuthService);
  podeEditar = computed(() => this.auth.pode('atendimentos', 'editar'));
  telefone = input.required<string>();
  mensagens = signal<MensagemConversa[]>([]);
  pausadoAte = signal<string | null>(null);
  enviando = signal(false);
  alterandoPausa = signal(false);
  erro = signal('');
  texto = '';

  private destroyRef = inject(DestroyRef);
  private historico = viewChild<ElementRef<HTMLElement>>('historico');
  private ultimaRolada?: number;

  constructor() {
    // Rola até o fim só quando chega mensagem nova: a consulta de 5 s não tira do lugar quem lê as antigas.
    afterRenderEffect(() => {
      const ultima = this.mensagens().at(-1)?.id;
      if (ultima === this.ultimaRolada) return;
      this.ultimaRolada = ultima;
      const lista = this.historico()?.nativeElement;
      if (lista) lista.scrollTop = lista.scrollHeight;
    });
  }

  ngOnInit() {
    this.carregar();
    const timer = setInterval(() => this.carregar(), 5000);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  private url() {
    return `${API_BASE}/conversas/${this.telefone()}`;
  }

  carregar() {
    this.http
      .get<{ mensagens: MensagemConversa[]; bot_pausado_ate: string | null }>(
        `${this.url()}/mensagens`,
      )
      .subscribe({
        next: (r) => {
          this.mensagens.set(r.mensagens);
          this.pausadoAte.set(r.bot_pausado_ate);
        },
        error: () => {},
      });
  }

  enviar() {
    const texto = this.texto.trim();
    if (!texto || this.enviando()) return;
    this.enviando.set(true);
    this.erro.set('');
    this.http
      .post<{ mensagem: MensagemConversa; enviado: boolean; bot_pausado_ate: string | null }>(
        `${this.url()}/mensagens`,
        { texto },
      )
      .subscribe({
        next: (r) => {
          this.enviando.set(false);
          this.texto = '';
          this.mensagens.update((lista) => [...lista, r.mensagem]);
          this.pausadoAte.set(r.bot_pausado_ate);
          // Sem confirmação imediata a mensagem segue na fila e é reenviada automaticamente.
          if (!r.enviado)
            this.erro.set(
              'O WhatsApp não confirmou agora; a mensagem ficou na fila e será reenviada.',
            );
        },
        error: () => {
          this.enviando.set(false);
          this.erro.set('Não foi possível enviar. Tente novamente.');
        },
      });
  }

  alternarPausa() {
    if (this.alterandoPausa()) return;
    this.alterandoPausa.set(true);
    this.http
      .post<{ bot_pausado_ate: string | null }>(`${this.url()}/pausa`, {
        pausar: !this.pausadoAte(),
      })
      .subscribe({
        next: (r) => {
          this.alterandoPausa.set(false);
          this.pausadoAte.set(r.bot_pausado_ate);
        },
        error: () => {
          this.alterandoPausa.set(false);
          this.erro.set('Não foi possível alterar a pausa do bot.');
        },
      });
  }
}
