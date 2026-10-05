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
import { AuthService } from '../../core/services/auth.service';
import { CategoriaCardapio, ProdutoCardapio } from '../../core/models/dashboard.model';

interface VariacaoForm {
  tamanho: string;
  preco: number;
}

@Component({
  selector: 'app-cardapio',
  standalone: true,
  imports: [IconComponent, CommonModule, FormsModule],
  templateUrl: './cardapio.component.html',
  styleUrls: ['../../shared/ui/page-actions.css', './cardapio.component.css'],
})
export class CardapioComponent implements OnInit {
  api = inject(ApiService);
  // Operador só pausa/ativa pratos; criar, editar preço e excluir são do administrador (API também bloqueia).
  private auth = inject(AuthService);
  ehAdmin = computed(() => this.auth.user()?.role === 'admin');
  diasSemana = DIAS_CARDAPIO;
  formDias = lerDiasCardapio('todos');
  nomeDias = nomeDiasCardapio;
  alternarDia(dia: string) {
    this.formDias = this.formDias.includes(dia)
      ? this.formDias.filter((d) => d !== dia)
      : [...this.formDias, dia];
  }

  cardapio = signal<CategoriaCardapio[]>([]);
  categorias = signal<any[]>([]);

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
  }

  carregarCardapio() {
    this.api.getCardapio().subscribe((res) => {
      this.cardapio.set(res);
    });
  }

  carregarCategorias() {
    this.api.getCategoriasCardapio().subscribe((res) => {
      this.categorias.set(res);
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
    this.api.toggleProduto(prod.id).subscribe((res) => {
      prod.ativo = res.ativo;
      const statusStr = res.ativo ? 'ativado' : 'pausado';
      this.mostrarToast(`Prato "${prod.nome}" foi ${statusStr} no robô do WhatsApp.`);
    });
  }

  confirmarExcluir(prod: ProdutoCardapio) {
    if (confirm(`Tem certeza que deseja remover "${prod.nome}" do cardápio?`)) {
      this.api.excluirProduto(prod.id).subscribe(() => {
        this.mostrarToast(`Prato "${prod.nome}" foi removido do cardápio.`);
        this.carregarCardapio();
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
