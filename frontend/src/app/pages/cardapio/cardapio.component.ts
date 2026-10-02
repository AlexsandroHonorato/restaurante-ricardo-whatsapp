import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { CategoriaCardapio, ProdutoCardapio } from '../../core/models/dashboard.model';

@Component({
  selector: 'app-cardapio',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cardapio-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Gestão do Cardápio & Disponibilidade</h1>
          <p class="page-subtitle">Ative ou pause itens instantaneamente no atendimento do robô do WhatsApp</p>
        </div>
      </div>

      <div class="categories-list">
        @for (cat of cardapio(); track cat.id) {
          <div class="glass-card category-card">
            <div class="category-header">
              <div class="cat-title-group">
                <h2>{{ cat.nome }}</h2>
                <p>{{ cat.descricao }}</p>
              </div>
              <span class="badge badge-prep">{{ cat.produtos.length }} itens</span>
            </div>

            <div class="products-table">
              @for (prod of cat.produtos; track prod.id) {
                <div class="product-row" [class.inactive]="!prod.ativo">
                  <div class="prod-main">
                    <div class="prod-info">
                      <strong>{{ prod.nome }}</strong>
                      @if (prod.descricao) {
                        <span class="prod-desc">{{ prod.descricao }}</span>
                      }
                    </div>
                  </div>

                  <!-- Variações e Preços -->
                  <div class="prod-variations">
                    @for (v of prod.variacoes; track v.id) {
                      <span class="var-badge">
                        <span class="var-size">{{ v.tamanho }}:</span>
                        <span class="var-price">{{ v.preco | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
                      </span>
                    }
                  </div>

                  <!-- Botão de Toggle -->
                  <div class="prod-toggle">
                    <button
                      class="btn btn-sm"
                      [class.btn-success]="prod.ativo"
                      [class.btn-secondary]="!prod.ativo"
                      (click)="toggleProduto(prod)"
                    >
                      <span>{{ prod.ativo ? '✅ Disponível' : '⏸️ Pausado' }}</span>
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .cardapio-page {
      display: flex;
      flex-direction: column;
      gap: 24px;
      padding-bottom: 40px;
    }

    .page-title {
      font-size: 1.6rem;
    }

    .page-subtitle {
      font-size: 0.85rem;
      color: var(--text-muted);
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
      font-size: 1.2rem;
      color: var(--text-primary);
    }

    .cat-title-group p {
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .products-table {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .product-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 14px;
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      transition: all var(--transition-fast);
    }

    .product-row.inactive {
      opacity: 0.5;
    }

    .prod-main {
      flex: 1;
    }

    .prod-info {
      display: flex;
      flex-direction: column;
    }

    .prod-info strong {
      font-size: 0.95rem;
      color: var(--text-primary);
    }

    .prod-desc {
      font-size: 0.775rem;
      color: var(--text-muted);
    }

    .prod-variations {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .var-badge {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border-color);
      padding: 4px 8px;
      border-radius: var(--radius-sm);
      font-size: 0.775rem;
      display: inline-flex;
      gap: 4px;
    }

    .var-size {
      color: var(--text-muted);
    }

    .var-price {
      color: #34D399;
      font-weight: 700;
    }

    .prod-toggle {
      flex-shrink: 0;
    }
  `]
})
export class CardapioComponent implements OnInit {
  api = inject(ApiService);
  cardapio = signal<CategoriaCardapio[]>([]);

  ngOnInit() {
    this.carregarCardapio();
  }

  carregarCardapio() {
    this.api.getCardapio().subscribe((res) => this.cardapio.set(res));
  }

  toggleProduto(prod: ProdutoCardapio) {
    this.api.toggleProduto(prod.id).subscribe(() => {
      prod.ativo = !prod.ativo;
    });
  }
}
