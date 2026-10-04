import { IconComponent } from '../../shared/ui/icon.component';
import { DIAS_CARDAPIO, lerDiasCardapio, gravarDiasCardapio, nomeDiasCardapio } from '../../core/models/dias-cardapio';
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { CategoriaCardapio, ProdutoCardapio } from '../../core/models/dashboard.model';

interface VariacaoForm {
  tamanho: string;
  preco: number;
}

@Component({
  selector: 'app-cardapio',
  standalone: true,
  imports: [IconComponent, CommonModule, FormsModule],
  template: `
    <div class="cardapio-page">
      <!-- Toast de Notificação -->
      @if (toastMensagem()) {
        <div class="toast-notification glass-card animate-fade-in">
          <span class="toast-icon">✨</span>
          <div class="toast-content">
            <strong>Cardápio Atualizado</strong>
            <p>{{ toastMensagem() }}</p>
          </div>
        </div>
      }

      <div class="page-header">
        <div>
          <h1 class="page-title">Gestão do Cardápio & Preços</h1>
          <p class="page-subtitle">Cadastre, edite e pause pratos e bebidas em tempo real no atendimento do WhatsApp</p>
        </div>

        <div class="header-actions">
          <button class="btn btn-primary" (click)="abrirModalNovo()">
            <app-icon nome="adicionar"/> Novo Prato / Item
          </button>
          <button class="refresh-btn glass-card" (click)="carregarCardapio()" title="Atualizar Cardápio">
            <app-icon nome="atualizar"/> Atualizar
          </button>
        </div>
      </div>

      <!-- Lista de Categorias e Produtos -->
      <div class="categories-list">
        @for (cat of cardapio(); track cat.id) {
          <div class="glass-card category-card">
            <div class="category-header">
              <div class="cat-title-group">
                <h2>{{ cat.nome }}</h2>
                <p>{{ cat.descricao }}</p>
              </div>
              <span class="badge badge-prep">{{ cat.produtos.length }} itens cadastrados</span>
            </div>

            <div class="products-table">
              @for (prod of cat.produtos; track prod.id) {
                <div class="product-row" [class.inactive]="!prod.ativo">
                  <div class="prod-main">
                    <div class="prod-info">
                      <div class="prod-name-row">
                        <strong>{{ prod.nome }}</strong>
                        <span class="status-indicator" [class.active]="prod.ativo" [class.paused]="!prod.ativo">
                          {{ prod.ativo ? '● Ativo no WhatsApp' : '○ Pausado' }}
                        </span>
                      </div>
                      @if (prod.descricao) {
                        <span class="prod-desc">{{ prod.descricao }}</span>
                      }
                    </div>
                  </div>

                  <span class="prod-desc">{{ nomeDias(prod.dias_disponiveis) }}</span>
              <!-- Variações e Preços -->
                  <div class="prod-variations">
                    @for (v of prod.variacoes; track v.id) {
                      <span class="var-badge">
                        <span class="var-size">{{ v.tamanho }}:</span>
                        <span class="var-price">{{ v.preco | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
                      </span>
                    }
                  </div>

                  <!-- Ações do Prato -->
                  <div class="prod-actions">
                    <button
                      class="btn btn-sm toggle-btn"
                      [class.btn-success]="prod.ativo"
                      [class.btn-secondary]="!prod.ativo"
                      (click)="toggleProduto(prod)"
                      title="Alternar disponibilidade no robô"
                    >
                      <app-icon [nome]="prod.ativo ? 'confirmar' : 'pausar'"/><span>{{ prod.ativo ? 'Ativo' : 'Pausado' }}</span>
                    </button>

                    <button class="action-icon-btn edit" (click)="abrirModalEditar(prod, cat.id)" [attr.aria-label]="'Editar ' + prod.nome" title="Editar Prato">
                      <app-icon nome="editar"/>
                    </button>

                    <button class="action-icon-btn delete" (click)="confirmarExcluir(prod)" [attr.aria-label]="'Excluir ' + prod.nome" title="Excluir Prato">
                      <app-icon nome="excluir"/>
                    </button>
                  </div>
                </div>
              } @empty {
                <div class="empty-cat">Nenhum item cadastrado nesta categoria.</div>
              }
            </div>
          </div>
        }
      </div>

      <!-- Modal de Cadastro / Edição -->
      @if (modalAberto()) {
        <div class="modal-overlay animate-fade-in" (click)="fecharModal()">
          <div class="modal-card glass-card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2>{{ modoEdicao() ? 'Editar Prato / Produto' : 'Novo Prato / Produto' }}</h2>
              <button class="close-btn" (click)="fecharModal()" aria-label="Fechar edição"><app-icon nome="fechar"/></button>
            </div>

            <form (ngSubmit)="salvarProduto()" class="modal-form">
              <div class="form-group">
                <label>Categoria *</label>
                <select [(ngModel)]="formCategoriaId" name="categoria_id" required>
                  <option [ngValue]="null" disabled>Selecione a categoria...</option>
                  @for (c of categorias(); track c.id) {
                    <option [ngValue]="c.id">{{ c.nome }}</option>
                  }
                </select>
              </div>

              <div class="form-group">
                <label>Nome do Prato / Item *</label>
                <input
                  type="text"
                  [(ngModel)]="formNome"
                  name="nome"
                  placeholder="Ex: Filé de Frango à Parmegiana"
                  required
                />
              </div>

              <div class="form-group">
                <label>Descrição / Acompanhamentos</label>
                <input
                  type="text"
                  [(ngModel)]="formDescricao"
                  name="descricao"
                  placeholder="Ex: Acompanha arroz, feijão, farofa e salada"
                />
              </div>

              <fieldset class="form-group" style="border:1px solid var(--border-color);padding:12px;border-radius:8px">
                <legend>Dias disponíveis *</legend>
                <div style="display:flex;flex-wrap:wrap;gap:12px">
                  @for(dia of diasSemana; track dia.valor) {<label style="display:flex;align-items:center;gap:6px"><input type="checkbox" style="width:auto" [checked]="formDias.includes(dia.valor)" (change)="alternarDia(dia.valor)" [disabled]="salvando()" />{{dia.nome}}</label>}
                </div>
                @if(!formDias.length){<p role="alert">Selecione pelo menos um dia.</p>}
              </fieldset>
              <!-- Variações de Tamanhos e Preços -->
              <div class="form-group">
                <div class="variations-header">
                  <label>Tamanhos e Preços (R$) *</label>
                  <button type="button" class="btn btn-secondary btn-xs" (click)="adicionarVariacao()">
                    <app-icon nome="adicionar"/> Adicionar Tamanho
                  </button>
                </div>

                <div class="variations-list">
                  @for (v of formVariacoes; track $index; let idx = $index) {
                    <div class="var-input-row">
                      <input
                        type="text"
                        [(ngModel)]="v.tamanho"
                        [name]="'tamanho_' + idx"
                        placeholder="Tamanho (ex: Grande, Infantil, 2L, Lata)"
                        required
                      />
                      <div class="price-input-wrap">
                        <span class="currency-prefix">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          [(ngModel)]="v.preco"
                          [name]="'preco_' + idx"
                          placeholder="0,00"
                          required
                        />
                      </div>
                      @if (formVariacoes.length > 1) {
                        <button type="button" class="remove-var-btn" (click)="removerVariacao(idx)" title="Remover tamanho">
                          <app-icon nome="fechar"/>
                        </button>
                      }
                    </div>
                  }
                </div>
              </div>

              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" (click)="fecharModal()">
                  Cancelar
                </button>
                <button type="submit" class="btn btn-primary" [disabled]="!formValido() || salvando()">
                  {{ modoEdicao() ? 'Salvar Alterações' : 'Cadastrar Prato' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styleUrls: ['../../shared/ui/page-actions.css'],
  styles: [`
    .cardapio-page {
      display: flex;
      flex-direction: column;
      gap: 24px;
      padding-bottom: 40px;
      position: relative;
    }

    /* Toast Notification */
    .toast-notification {
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 9999;
      background: rgba(17, 24, 39, 0.95);
      border: 1px solid #10B981;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 14px;
      border-radius: var(--radius-md);
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(16, 185, 129, 0.3);
      max-width: 450px;
      animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    .toast-icon {
      font-size: 1.8rem;
    }

    .toast-content strong {
      color: #34D399;
      font-size: 0.9rem;
      display: block;
      margin-bottom: 2px;
    }

    .toast-content p {
      color: var(--text-primary);
      font-size: 0.8rem;
      margin: 0;
    }

    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
    }

    .page-title {
      font-size: 1.6rem;
    }

    .page-subtitle {
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .refresh-btn {
      background: var(--bg-surface-elevated);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
      padding: 9px 16px;
      border-radius: var(--radius-sm);
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .refresh-btn:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .categories-list {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .category-card {
      padding: 22px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .category-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 12px;
    }

    .cat-title-group h2 {
      font-size: 1.25rem;
      color: var(--text-primary);
    }

    .cat-title-group p {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-top: 2px;
    }

    .products-table {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .product-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      transition: all var(--transition-fast);
      gap: 16px;
      flex-wrap: wrap;
    }

    .product-row:hover {
      background: rgba(255, 255, 255, 0.04);
      border-color: rgba(255, 255, 255, 0.15);
    }

    .product-row.inactive {
      opacity: 0.6;
      border-style: dashed;
      background: rgba(0, 0, 0, 0.2);
    }

    .prod-main {
      flex: 2;
      min-width: 220px;
    }

    .prod-name-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .prod-name-row strong {
      font-size: 0.95rem;
      color: var(--text-primary);
    }

    .status-indicator {
      font-size: 0.725rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 9999px;
    }

    .status-indicator.active {
      color: #34D399;
      background: rgba(16, 185, 129, 0.1);
    }

    .status-indicator.paused {
      color: #F87171;
      background: rgba(239, 68, 68, 0.1);
    }

    .prod-desc {
      font-size: 0.775rem;
      color: var(--text-muted);
      display: block;
      margin-top: 3px;
    }

    .prod-variations {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      flex: 2;
      justify-content: flex-start;
    }

    .var-badge {
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-color);
      padding: 4px 10px;
      border-radius: var(--radius-sm);
      font-size: 0.775rem;
      display: flex;
      gap: 6px;
    }

    .var-size {
      color: var(--text-secondary);
    }

    .var-price {
      font-weight: 700;
      color: #34D399;
    }

    .prod-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .toggle-btn {
      min-width: 110px;
      font-size: 0.8rem;
    }

    .action-icon-btn {
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      width: 34px;
      height: 34px;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all var(--transition-fast);
    }

    .action-icon-btn.edit:hover {
      background: rgba(59, 130, 246, 0.2);
      border-color: #3B82F6;
    }

    .action-icon-btn.delete:hover {
      background: rgba(239, 68, 68, 0.2);
      border-color: #EF4444;
    }

    .empty-cat {
      color: var(--text-muted);
      font-size: 0.85rem;
      padding: 12px;
      text-align: center;
    }

    /* Modal Overlay & Card */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .modal-card {
      width: 100%;
      max-width: 540px;
      background: #182234;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: var(--radius-lg);
      padding: 24px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 12px;
    }

    .modal-header h2 {
      font-size: 1.25rem;
    }

    .close-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 1.2rem;
      cursor: pointer;
    }

    .modal-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-group label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-secondary);
    }

    .form-group input, .form-group select {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      padding: 10px 14px;
      color: var(--text-primary);
      font-size: 0.9rem;
      outline: none;
      font-family: inherit;
    }

    .form-group input:focus, .form-group select:focus {
      border-color: var(--primary);
    }

    .variations-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }

    .btn-xs {
      padding: 4px 8px;
      font-size: 0.75rem;
      border-radius: var(--radius-sm);
    }

    .variations-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .var-input-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .var-input-row input {
      flex: 2;
    }

    .price-input-wrap {
      flex: 1.5;
      display: flex;
      align-items: center;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      padding-left: 10px;
    }

    .currency-prefix {
      color: var(--text-muted);
      font-size: 0.8rem;
      font-weight: 600;
    }

    .price-input-wrap input {
      border: none !important;
      background: transparent !important;
      padding-left: 6px !important;
      width: 100%;
    }

    .remove-var-btn {
      background: rgba(239, 68, 68, 0.1);
      color: #EF4444;
      border: 1px solid rgba(239, 68, 68, 0.2);
      width: 32px;
      height: 32px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 10px;
      border-top: 1px solid var(--border-color);
      padding-top: 14px;
    }

`]
})
export class CardapioComponent implements OnInit {
  api = inject(ApiService);
  diasSemana = DIAS_CARDAPIO;
  formDias = lerDiasCardapio('todos');
  nomeDias = nomeDiasCardapio;
  alternarDia(dia: string) {this.formDias = this.formDias.includes(dia) ? this.formDias.filter(d=>d!==dia) : [...this.formDias,dia];}

  cardapio = signal<CategoriaCardapio[]>([]);
  categorias = signal<any[]>([]);

  salvando = signal(false);
  modalAberto = signal<boolean>(false);
  modoEdicao = signal<boolean>(false);
  editandoId: number | null = null;

  formCategoriaId: number | null = null;
  formNome: string = '';
  formDescricao: string = '';
  formVariacoes: VariacaoForm[] = [{ tamanho: 'Grande', preco: 30.00 }];
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
    this.formVariacoes = [{ tamanho: 'Padrão', preco: 25.00 }];
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
      preco: Number(v.preco)
    }));
    if (this.formVariacoes.length === 0) {
      this.formVariacoes = [{ tamanho: 'Padrão', preco: 20.00 }];
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
      this.formVariacoes.every((v) => v.tamanho.trim() && Number.isFinite(Number(v.preco)) && v.preco >= 0)
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
      variacoes: this.formVariacoes
    };
    const requisicao = this.modoEdicao() && this.editandoId
      ? this.api.atualizarProduto(this.editandoId, payload)
      : this.api.criarProduto(payload);
    requisicao.pipe(finalize(() => this.salvando.set(false))).subscribe({
      next: () => {
        this.mostrarToast(`Prato "${this.formNome}" salvo no cardápio.`);
        this.fecharModal();
        this.carregarCardapio();
      },
      error: () => this.mostrarToast('Não foi possível salvar o produto. Verifique os campos e tente novamente.')
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
