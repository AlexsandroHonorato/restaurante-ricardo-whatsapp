import { DestroyRef, Injectable, inject, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { exhaustMap, timer } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class TransbordoService {
  private api = inject(ApiService);
  private destroyRef = inject(DestroyRef);
  private iniciado = false;
  private recebidos = false;
  private ativos = new Set<string>();
  private chegada = new Map<string, number>();
  fechados = signal(new Set<string>());
  fila = computed(() => this.conversas().filter(s => s.status_atual === 'transbordo_humano' && !s.contato_iniciado_em)
    .sort((a,b) => (this.chegada.get(String(a.id)) ?? 0) - (this.chegada.get(String(b.id)) ?? 0)));
  alertas = computed(() => this.fila().filter(s => !this.fechados().has(String(s.id))));
  fechar(id: number) { this.fechados.update(ids => new Set([...ids, String(id)])); }
  assumir(id: number) { this.conversas.update(conversas => conversas.map(s => s.id === id ? { ...s, contato_iniciado_em: new Date().toISOString() } : s)); }
  mostrarAlertas() { this.fechados.set(new Set()); }
  conversas = signal<any[]>([]);
  aguardando = computed(() => this.fila().length);
  eventos = signal(0);

  iniciar() {
    if (this.iniciado) return;
    this.iniciado = true;
    timer(0, 5000).pipe(
      exhaustMap(() => this.api.getStatusConversas()),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(conversas => {
      const atuais = new Set<string>(conversas
        .filter(s => s.status_atual === 'transbordo_humano' && !s.contato_iniciado_em)
        .map(s => String(s.id)));
      if (this.recebidos && [...atuais].some(id => !this.ativos.has(id))) {
        this.eventos.update(valor => valor + 1);
      }
      for (const id of this.chegada.keys()) if (!atuais.has(id)) this.chegada.delete(id);
      for (const s of conversas) {
        const id = String(s.id);
        if (atuais.has(id) && !this.chegada.has(id)) this.chegada.set(id, Date.parse(s.ultimo_contato_em) || Date.now());
      }
      this.fechados.update(ids => new Set([...ids].filter(id => atuais.has(id))));
      this.recebidos = true;
      this.ativos = atuais;

      this.conversas.set(conversas);
    });
  }
}


