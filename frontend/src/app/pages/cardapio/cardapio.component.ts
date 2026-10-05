import { IconComponent } from '../../shared/ui/icon.component';
import {
  DIAS_CARDAPIO,
  lerDiasCardapio,
  gravarDiasCardapio,
  nomeDiasCardapio,
} from '../../core/models/dias-cardapio';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import {
  CategoriaCardapio,
  HorarioAtendimento,
  ProdutoCardapio,
} from '../../core/models/dashboard.model';

interface VariacaoForm {
  tamanho: string;
  preco: number;
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

/** Cardápio em Configurações (só administrador; a API também bloqueia as alterações). */
@Component({
  selector: 'app-cardapio',
  standalone: true,
  imports: [IconComponent, CommonModule, FormsModule],
  templateUrl: './cardapio.component.html',
  styleUrls: ['../../shared/ui/page-actions.css', './cardapio.component.css'],
})
export class CardapioComponent implements OnInit {
  api = inject(ApiService);
  diasSemana = DIAS_CARDAPIO;
  formDias = lerDiasCardapio('todos');
  nomeDias = nomeDiasCardapio;
  lerDias = lerDiasCardapio;
  diaHoje = indiceHoje();
  alternarDia(dia: string) {
    this.formDias = this.formDias.includes(dia)
      ? this.formDias.filter((d) => d !== dia)
      : [...this.formDias, dia];
  }

  /** Atalhos do formulário; "Dias de atendimento" só aparece quando algum dia está fechado na agenda. */
  atalhosDias() {
    const todos = DIAS_CARDAPIO.map((d) => d.valor);
    const abertos = todos.filter((_, i) => !this.diaFechado(i));
    return [
      { rotulo: 'Todos os dias', dias: todos },
      ...(abertos.length < 7 && abertos.length
        ? [{ rotulo: 'Dias de atendimento', dias: abertos }]
        : []),
      { rotulo: 'Segunda a sexta', dias: todos.slice(0, 5) },
      { rotulo: 'Fim de semana', dias: todos.slice(5) },
    ];
  }

  atalhoAtivo(dias: string[]) {
    return dias.length === this.formDias.length && dias.every((d) => this.formDias.includes(d));
  }

  aplicarAtalho(dias: string[]) {
    this.formDias = [...dias];
  }

  resumoDiasForm() {
    return nomeDiasCardapio(gravarDiasCardapio(this.formDias));
  }

  /** Dias marcados em que o estabelecimento não abre ("todos" já significa "sempre que abrir"). */
  diasFechadosMarcados() {
    if (this.formDias.length === 7) return [];
    return DIAS_CARDAPIO.filter(
      (d, i) => this.diaFechado(i) && this.formDias.includes(d.valor),
    ).map((d) => d.nome);
  }

  cardapio = signal<CategoriaCardapio[]>([]);
  categorias = signal<any[]>([]);
  horarios = signal<HorarioAtendimento[]>([]);
  carregando = signal(false);
  erroLista = signal<string | null>(null);
  erroAcao = signal<string | null>(null);
  ocupados = signal(new Set<number>());

  // Filtros
  busca = signal('');
  categoriaFiltro = signal<number | null>(null);
  diaFiltro = signal('');
  situacaoFiltro = signal<'' | 'ativos' | 'pausados'>('');

  categoriasVisiveis = computed(() => {
    const busca = normalizar(this.busca().trim());
    const dia = this.diaFiltro();
    const situacao = this.situacaoFiltro();
    return this.cardapio()
      .filter((c) => !this.categoriaFiltro() || c.id === this.categoriaFiltro())
      .map((c) => ({
        ...c,
        produtos: c.produtos.filter(
          (p) =>
            normalizar(p.nome).includes(busca) &&
            (!dia || lerDiasCardapio(p.dias_disponiveis).includes(dia)) &&
            (!situacao || (situacao === 'ativos') === p.ativo),
        ),
      }))
      .filter((c) => c.produtos.length || !this.filtrando());
  });
  totalVisivel = computed(() =>
    this.categoriasVisiveis().reduce((soma, c) => soma + c.produtos.length, 0),
  );
  filtrando = computed(
    () =>
      !!(
        this.busca().trim() ||
        this.categoriaFiltro() ||
        this.diaFiltro() ||
        this.situacaoFiltro()
      ),
  );

  /** O que o bot oferece hoje: ativos com o dia de hoje (itens só de alguns dias aparecem por nome). */
  hoje = computed(() => {
    const dia = DIAS_CARDAPIO[this.diaHoje].valor;
    const produtos = this.cardapio()
      .flatMap((c) => c.produtos)
      .filter((p) => p.ativo && lerDiasCardapio(p.dias_disponiveis).includes(dia));
    return {
      nomeDia: DIAS_CARDAPIO[this.diaHoje].nome,
      total: produtos.length,
      especiais: produtos
        .filter((p) => lerDiasCardapio(p.dias_disponiveis).length < 7)
        .map((p) => p.nome),
    };
  });

  salvando = signal(false);
  modalAberto = signal<boolean>(false);
  modoEdicao = signal<boolean>(false);
  editandoId: number | null = null;

  formCategoriaId: number | null = null;
  formNome: string = '';
  formDescricao: string = '';
  formVariacoes: VariacaoForm[] = [{ tamanho: 'Grande', preco: 30.0 }];
  toastMensagem = signal<string | null>(null);

  ngOnInit() {
    this.carregarCardapio();
    this.carregarCategorias();
    // Sem a agenda a tela funciona igual, só não marca os dias fechados.
    this.api.getHorariosAtendimento().subscribe({
      next: (res) => this.horarios.set(res.horarios),
      error: () => this.horarios.set([]),
    });
  }

  carregarCardapio() {
    this.carregando.set(true);
    this.api
      .getCardapioConfiguracao()
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({
        next: (res) => {
          this.cardapio.set(res);
          this.erroLista.set(null);
        },
        error: () =>
          this.erroLista.set('Não foi possível carregar o cardápio. Verifique a conexão.'),
      });
  }

  carregarCategorias() {
    this.api.getCategoriasCardapio().subscribe((res) => {
      this.categorias.set(res);
    });
  }

  diaFechado(indice: number) {
    const horario = this.horarios().find((h) => h.dia_semana === indice + 1);
    return horario ? !horario.ativo : false;
  }

  limparFiltros() {
    this.busca.set('');
    this.categoriaFiltro.set(null);
    this.diaFiltro.set('');
    this.situacaoFiltro.set('');
  }

  private atualizarLocal(id: number, mudanca: Partial<ProdutoCardapio>) {
    this.cardapio.update((cats) =>
      cats.map((c) => ({
        ...c,
        produtos: c.produtos.map((p) => (p.id === id ? { ...p, ...mudanca } : p)),
      })),
    );
  }

  private ocupar(id: number, ocupado: boolean) {
    this.ocupados.update((ids) => {
      const novos = new Set(ids);
      if (ocupado) novos.add(id);
      else novos.delete(id);
      return novos;
    });
  }

  /** Liga/desliga um dia direto na lista e salva na hora; se a API recusar, volta ao que era. */
  alternarDiaProduto(prod: ProdutoCardapio, dia: string) {
    if (this.ocupados().has(prod.id)) return;
    const atuais = lerDiasCardapio(prod.dias_disponiveis);
    const dias = atuais.includes(dia) ? atuais.filter((d) => d !== dia) : [...atuais, dia];
    if (!dias.length) {
      this.erroAcao.set(`${prod.nome}: deixe pelo menos um dia marcado.`);
      return;
    }
    const anterior = prod.dias_disponiveis;
    const valor = gravarDiasCardapio(dias);
    this.erroAcao.set(null);
    this.ocupar(prod.id, true);
    this.atualizarLocal(prod.id, { dias_disponiveis: valor });
    this.api
      .atualizarProduto(prod.id, { dias_disponiveis: valor })
      .pipe(finalize(() => this.ocupar(prod.id, false)))
      .subscribe({
        error: () => {
          this.atualizarLocal(prod.id, { dias_disponiveis: anterior });
          this.erroAcao.set(`${prod.nome}: não foi possível salvar os dias. Tente novamente.`);
        },
      });
  }

  abrirModalNovo() {
    this.modoEdicao.set(false);
    this.editandoId = null;
    this.formCategoriaId = this.categorias()[0]?.id || null;
    this.formDias = lerDiasCardapio('todos');
    this.formNome = '';
    this.formDescricao = '';
    this.formVariacoes = [{ tamanho: 'Padrão', preco: 25.0 }];
    this.modalAberto.set(true);
  }

  abrirModalEditar(prod: ProdutoCardapio, categoriaId: number) {
    this.modoEdicao.set(true);
    this.editandoId = prod.id;
    this.formCategoriaId = categoriaId;
    this.formDias = lerDiasCardapio(prod.dias_disponiveis);
    this.formNome = prod.nome;
    this.formDescricao = prod.descricao || '';
    this.formVariacoes = prod.variacoes.map((v) => ({
      tamanho: v.tamanho,
      preco: Number(v.preco),
    }));
    if (this.formVariacoes.length === 0) {
      this.formVariacoes = [{ tamanho: 'Padrão', preco: 20.0 }];
    }
    this.modalAberto.set(true);
  }

  fecharModal() {
    this.modalAberto.set(false);
  }

  adicionarVariacao() {
    this.formVariacoes.push({ tamanho: '', preco: 0 });
  }

  removerVariacao(idx: number) {
    if (this.formVariacoes.length > 1) {
      this.formVariacoes.splice(idx, 1);
    }
  }

  formValido(): boolean {
    return !!(
      this.formCategoriaId &&
      this.formNome.trim() &&
      this.formDias.length > 0 &&
      this.formVariacoes.length > 0 &&
      this.formVariacoes.every(
        (v) => v.tamanho.trim() && Number.isFinite(Number(v.preco)) && v.preco >= 0,
      )
    );
  }

  salvarProduto() {
    if (!this.formValido() || this.salvando()) return;
    this.salvando.set(true);
    const payload = {
      categoria_id: this.formCategoriaId,
      nome: this.formNome.trim(),
      descricao: this.formDescricao.trim(),
      dias_disponiveis: gravarDiasCardapio(this.formDias),
      variacoes: this.formVariacoes,
    };
    const requisicao =
      this.modoEdicao() && this.editandoId
        ? this.api.atualizarProduto(this.editandoId, payload)
        : this.api.criarProduto(payload);
    requisicao.pipe(finalize(() => this.salvando.set(false))).subscribe({
      next: () => {
        this.mostrarToast(`Prato "${this.formNome}" salvo no cardápio.`);
        this.fecharModal();
        this.carregarCardapio();
      },
      error: () =>
        this.mostrarToast(
          'Não foi possível salvar o produto. Verifique os campos e tente novamente.',
        ),
    });
  }

  toggleProduto(prod: ProdutoCardapio) {
    if (this.ocupados().has(prod.id)) return;
    this.erroAcao.set(null);
    this.ocupar(prod.id, true);
    this.api
      .toggleProduto(prod.id)
      .pipe(finalize(() => this.ocupar(prod.id, false)))
      .subscribe({
        next: (res) => {
          this.atualizarLocal(prod.id, { ativo: res.ativo });
          const statusStr = res.ativo ? 'ativado' : 'pausado';
          this.mostrarToast(`Prato "${prod.nome}" foi ${statusStr} no robô do WhatsApp.`);
        },
        error: () => this.erroAcao.set(`${prod.nome}: não foi possível alterar a disponibilidade.`),
      });
  }

  confirmarExcluir(prod: ProdutoCardapio) {
    if (confirm(`Tem certeza que deseja remover "${prod.nome}" do cardápio?`)) {
      this.erroAcao.set(null);
      this.api.excluirProduto(prod.id).subscribe({
        next: () => {
          this.mostrarToast(`Prato "${prod.nome}" foi removido do cardápio.`);
          this.carregarCardapio();
        },
        error: () => this.erroAcao.set(`${prod.nome}: não foi possível excluir.`),
      });
    }
  }

  mostrarToast(msg: string) {
    this.toastMensagem.set(msg);
    setTimeout(() => {
      this.toastMensagem.set(null);
    }, 4500);
  }
}
