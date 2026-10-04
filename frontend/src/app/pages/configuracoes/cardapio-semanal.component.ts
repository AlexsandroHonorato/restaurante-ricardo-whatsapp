import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { catchError, from, map, mergeMap, of, toArray } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { ComAlteracoesPendentes } from '../../core/alteracoes-pendentes.guard';
import { HorarioAtendimento, ProdutoCardapio } from '../../core/models/dashboard.model';
import {
  DIAS_CARDAPIO,
  lerDiasCardapio,
  gravarDiasCardapio,
} from '../../core/models/dias-cardapio';

interface Linha {
  produto: ProdutoCardapio;
  categoria: string;
  pratoDoDia: boolean;
  dias: string[];
  original: string;
  erro: string | null;
}

const normalizar = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Índice em DIAS_CARDAPIO (0 = segunda) do dia atual no fuso do restaurante. */
function indiceHoje(): number {
  const dia = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
  }).format(new Date());
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(dia);
}

@Component({
  selector: 'app-cardapio-semanal',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './cardapio-semanal.component.html',
  styleUrl: './cardapio-semanal.component.css',
})
export class CardapioSemanalComponent implements OnInit, ComAlteracoesPendentes {
  private api = inject(ApiService);
  semana = DIAS_CARDAPIO;
  linhas = signal<Linha[]>([]);
  horarios = signal<HorarioAtendimento[] | null>(null);
  erro = signal<string | null>(null);
  carregando = signal(false);
  salvando = signal(false);
  mensagem = signal<{ texto: string; erro: boolean } | null>(null);
  busca = signal('');
  categoria = signal('');
  mostrarFixos = signal(false);
  diaHoje = signal(indiceHoje());

  ngOnInit() {
    this.carregar();
  }

  carregar() {
    this.carregando.set(true);
    this.erro.set(null);
    this.api.getCardapioConfiguracao().subscribe({
      next: (cats) => {
        this.linhas.set(
          cats.flatMap((c) =>
            c.produtos.map((produto) => ({
              produto,
              categoria: c.nome,
              pratoDoDia: this.ehPratoDoDia(c.nome),
              dias: lerDiasCardapio(produto.dias_disponiveis),
              original: gravarDiasCardapio(lerDiasCardapio(produto.dias_disponiveis)),
              erro: null,
            })),
          ),
        );
        this.carregando.set(false);
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set('Não foi possível carregar os pratos.');
      },
    });
    // Sem agenda a tela continua funcionando, só não bloqueia dias fechados.
    this.api.getHorariosAtendimento().subscribe({
      next: (res) => this.horarios.set(res.horarios),
      error: () => this.horarios.set(null),
    });
  }

  // ---------------------------------------------------------------- dias e categorias
  curto(nome: string) {
    return nome.slice(0, 3).toUpperCase();
  }

  diaFechado(indice: number) {
    const horario = this.horarios()?.find((h) => h.dia_semana === indice + 1);
    return horario ? !horario.ativo : false;
  }

  ehPratoDoDia(categoria: string) {
    const nome = normalizar(categoria);
    return nome.includes('dia') && !nome.includes('diario');
  }

  iconeCategoria(categoria: string) {
    const nome = normalizar(categoria);
    if (nome.includes('cerveja')) return 'M7 7h9v13H7z M16 9h3v8h-3 M7 4v3 M11 3v4';
    if (nome.includes('bebida')) return 'M8 3h8l-1 18H9z M8 7h8 M13 3l3-2';
    if (nome.includes('adicion')) return 'M12 5v14 M5 12h14';
    if (nome.includes('porc')) return 'M3 10h18 M5 10l2 10h10l2-10 M8 3v5 M12 3v5 M16 3v5';
    if (this.ehPratoDoDia(categoria)) return 'M5 5h14v15H5z M8 3v4 M16 3v4 M5 10h14 M9 14l2 2 4-4';
    return 'M4 3v6 M7 3v6 M10 3v6 M4 7h6 M7 9v12 M17 3v18 M17 3c4 3 4 8 0 9';
  }

  categorias() {
    return [...new Set(this.linhas().map((l) => l.categoria))];
  }

  // ---------------------------------------------------------------- agrupamento
  filtradas() {
    const busca = normalizar(this.busca());
    return this.linhas().filter(
      (l) =>
        (!this.categoria() || l.categoria === this.categoria()) &&
        normalizar(l.produto.nome).includes(busca),
    );
  }

  /** "Fixo" usa o valor salvo, para a linha não pular de seção enquanto é editada. */
  private fixo(l: Linha) {
    const salvos = lerDiasCardapio(l.original);
    return (
      !l.pratoDoDia && this.semana.every((d, i) => this.diaFechado(i) || salvos.includes(d.valor))
    );
  }

  secoes() {
    const filtradas = this.filtradas();
    return {
      pratosDoDia: filtradas.filter((l) => l.pratoDoDia),
      variaveis: filtradas.filter((l) => !l.pratoDoDia && !this.fixo(l)),
      fixos: filtradas.filter((l) => this.fixo(l)),
    };
  }

  fixosVisiveis() {
    return this.mostrarFixos() || this.busca().trim() !== '';
  }

  // ---------------------------------------------------------------- resumo por dia
  pratosDoDiaNoDia(indice: number) {
    const dia = this.semana[indice].valor;
    return this.linhas().filter((l) => l.pratoDoDia && l.produto.ativo && l.dias.includes(dia))
      .length;
  }

  semPratoDoDia(indice: number) {
    return (
      !this.diaFechado(indice) &&
      this.linhas().some((l) => l.pratoDoDia) &&
      this.pratosDoDiaNoDia(indice) === 0
    );
  }

  /** O que já está salvo para hoje (o bot lê o cardápio salvo, não as edições pendentes). */
  disponivelHoje() {
    const dia = this.semana[this.diaHoje()].valor;
    const hoje = this.linhas().filter(
      (l) => l.produto.ativo && lerDiasCardapio(l.original).includes(dia),
    );
    return {
      pratosDoDia: hoje.filter((l) => l.pratoDoDia).map((l) => l.produto.nome),
      outros: hoje.filter((l) => !l.pratoDoDia).length,
    };
  }

  // ---------------------------------------------------------------- edição
  alterada(l: Linha) {
    return gravarDiasCardapio(l.dias) !== l.original;
  }

  pendentes() {
    return this.linhas().filter((l) => this.alterada(l));
  }

  temAlteracoesPendentes() {
    return this.pendentes().length > 0;
  }

  alternar(l: Linha, indice: number) {
    if (this.salvando() || this.diaFechado(indice)) return;
    const dia = this.semana[indice].valor;
    l.dias = l.dias.includes(dia) ? l.dias.filter((x) => x !== dia) : [...l.dias, dia];
    l.erro = null;
    this.mensagem.set(null);
  }

  desfazerTudo() {
    if (this.salvando()) return;
    for (const l of this.pendentes()) {
      l.dias = lerDiasCardapio(l.original);
      l.erro = null;
    }
    this.mensagem.set(null);
  }

  salvarTudo() {
    const alteradas = this.pendentes();
    if (this.salvando() || !alteradas.length) return;
    const semDias = alteradas.filter((l) => !l.dias.length);
    if (semDias.length) {
      this.mensagem.set({
        texto: `Selecione pelo menos um dia em: ${semDias.map((l) => l.produto.nome).join(', ')}.`,
        erro: true,
      });
      return;
    }
    this.salvando.set(true);
    this.mensagem.set(null);
    from(alteradas)
      .pipe(
        mergeMap((l) => {
          const valor = gravarDiasCardapio(l.dias);
          return this.api.atualizarProduto(l.produto.id, { dias_disponiveis: valor }).pipe(
            map(() => ({ l, valor, ok: true })),
            catchError(() => of({ l, valor, ok: false })),
          );
        }, 3),
        toArray(),
      )
      .subscribe((resultados) => {
        for (const { l, valor, ok } of resultados) {
          if (ok) l.original = valor;
          l.erro = ok ? null : 'Não foi possível salvar.';
        }
        const falhas = resultados.filter((r) => !r.ok).length;
        const salvos = resultados.length - falhas;
        this.salvando.set(false);
        this.mensagem.set(
          falhas
            ? {
                texto: `${salvos} salvo(s), ${falhas} com erro. Os pratos com erro continuam marcados; tente novamente.`,
                erro: true,
              }
            : { texto: `${salvos} prato(s) salvo(s).`, erro: false },
        );
      });
  }

  /** Avisa o navegador ao fechar ou recarregar a aba com alterações não salvas. */
  @HostListener('window:beforeunload', ['$event'])
  aoSairDaPagina(evento: BeforeUnloadEvent) {
    if (this.temAlteracoesPendentes()) evento.preventDefault();
  }
}
