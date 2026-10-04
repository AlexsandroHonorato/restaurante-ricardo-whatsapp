import { IconComponent } from '../../shared/ui/icon.component';
import { PedidoStatusComponent } from '../../shared/ui/pedido-status.component';
import { Component, OnInit, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { Pedido } from '../../core/models/dashboard.model';

@Component({
  selector: 'app-pedidos',
  standalone: true,
  imports: [IconComponent, CommonModule, FormsModule, PedidoStatusComponent],
  template: `
    <div class="pedidos-page">
      <dialog #cancelamentoDialog class="cancelamento-dialog" aria-labelledby="cancelamento-titulo" aria-describedby="cancelamento-descricao" (cancel)="aoCancelarDialog($event)" (close)="cancelando.set(null)">
        <form (ngSubmit)="confirmarCancelamento()" class="cancelamento-form">
          <div class="cancelamento-heading"><span class="cancelamento-icon" aria-hidden="true">×</span><button type="button" class="cancelamento-fechar" aria-label="Fechar cancelamento" [disabled]="salvandoCancelamento()" (click)="fecharCancelamento()">×</button></div>
          <h2 id="cancelamento-titulo">Cancelar pedido</h2>
          <p id="cancelamento-descricao">{{cancelando()?.codigo_pedido}} · Informe o motivo para registrar o cancelamento deste pedido.</p>
          <label for="motivo-cancelamento">Motivo do cancelamento <span aria-hidden="true">*</span></label>
          <textarea id="motivo-cancelamento" name="motivoCancelamento" [(ngModel)]="motivoCancelamento" maxlength="255" required rows="4" autofocus placeholder="Ex.: cliente desistiu do pedido" [disabled]="salvandoCancelamento()"></textarea>
          <small class="cancelamento-contador">{{motivoCancelamento.length}} / 255 caracteres</small>
          @if (erroCancelamento()) {<p role="alert" class="cancelamento-erro">{{ erroCancelamento() }}</p>}
          <div class="cancelamento-footer"><button type="button" class="btn btn-secondary" [disabled]="salvandoCancelamento()" (click)="fecharCancelamento()">Voltar</button><button type="submit" class="btn btn-primary" [disabled]="!motivoCancelamento.trim() || salvandoCancelamento()">{{salvandoCancelamento()?'Cancelando…':'Confirmar cancelamento'}}</button></div>
        </form>
      </dialog>
      <!-- Toast de Notificação -->
      @if (toastMensagem()) {
        <div class="toast-notification glass-card animate-fade-in">
          <span class="toast-icon">🛵💨</span>
          <div class="toast-content">
            <strong>Notificação Automática WhatsApp</strong>
            <p>{{ toastMensagem() }}</p>
          </div>
        </div>
      }

      <div class="page-header">
        <div>
          <h1 class="page-title">Gestão Operacional de Pedidos</h1>
          <p class="page-subtitle">Acompanhe a cozinha, despache entregas e notifique clientes em tempo real</p>
        </div>

        <div class="header-actions">
          <!-- Toggle de Visão (Cards vs Lista) -->
          <div class="view-toggle glass-card">
            <button
              class="view-btn"
              [class.active]="modoVisao() === 'cards'"
              (click)="alternarVisao('cards')"
              title="Visualização em Cards Kanban"
            >
              <app-icon nome="dashboard"/> Cards
            </button>
            <button
              class="view-btn"
              [class.active]="modoVisao() === 'lista'"
              (click)="alternarVisao('lista')"
              title="Visualização em Tabela Detalhada"
            >
              <app-icon nome="lista"/> Lista
            </button>
          </div>

          <!-- Filtros de Status -->
          <div class="status-filters">
            <button class="filter-pill" [class.active]="filtroStatus() === ''" (click)="filtrarStatus('')">Todos</button>
            <button class="filter-pill pending" [class.active]="filtroStatus() === 'pendente'" (click)="filtrarStatus('pendente')">Pendentes</button>
            <button class="filter-pill prep" [class.active]="filtroStatus() === 'em_preparo'" (click)="filtrarStatus('em_preparo')">Na Cozinha</button>
            <button class="filter-pill delivery" [class.active]="filtroStatus() === 'saiu_para_entrega'" (click)="filtrarStatus('saiu_para_entrega')">Em Rota</button>
            <button class="filter-pill delivered" [class.active]="filtroStatus() === 'entregue'" (click)="filtrarStatus('entregue')">Entregues</button>
          </div>
        </div>
      </div>

      <!-- Barra de Busca -->
      <div class="search-bar glass-card">
        <span class="search-icon"><app-icon nome="buscar"/></span>
        <input
          type="text"
          placeholder="Buscar por código (PED-...), nome do cliente, bairro ou telefone..."
          [(ngModel)]="termoBusca"
          (ngModelChange)="buscar()"
        />
        <button class="refresh-btn" (click)="carregarPedidos()" title="Atualizar Pedidos">
          <app-icon nome="atualizar"/> Atualizar
        </button>
      </div>

      <!-- 1. VISÃO EM CARDS (GRID KANBAN) -->
      @if (modoVisao() === 'cards') {
        <div class="orders-grid">
          @for (pedido of pedidos(); track pedido.id) {
            <div class="glass-card order-card" [class.highlight]="pedido.status === 'em_preparo'" [class.in-delivery]="pedido.status === 'saiu_para_entrega'">
              <div class="order-card-header">
                <div class="order-id-group">
                  <span class="order-code">{{ pedido.codigo_pedido }}</span>
                  <span class="order-time">{{ pedido.created_at | date:'HH:mm • dd/MM' }}</span>
                </div>
                <app-pedido-status [status]="pedido.status" />
              </div>

              <!-- Cliente & Endereço -->
              <div class="order-customer-box">
                <div class="cust-row">
                  <strong>👤 {{ pedido.cliente?.nome || 'Cliente WhatsApp' }}</strong>
                  <a [href]="'https://wa.me/' + pedido.cliente?.telefone" target="_blank" class="tel-link">
                    <app-icon nome="atendimentos"/> {{ pedido.cliente?.telefone }}
                  </a>
                </div>
                <div class="addr-text">
                  <app-icon nome="local"/> {{ pedido.endereco?.logradouro }}, {{ pedido.endereco?.numero }} — <strong>{{ pedido.endereco?.bairro }}</strong>
                </div>
              </div>

              <!-- Itens do Pedido -->
              <div class="order-items-list">
                @for (item of pedido.itens; track item.id) {
                  <div class="order-item-row">
                    <div class="item-desc">
                      <span class="item-qty">{{ item.quantidade }}x</span>
                      <span class="item-name">{{ item.nome_snapshot }} ({{ item.tamanho_snapshot }})</span>
                    </div>
                    <span class="item-price">{{ item.subtotal | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
                  </div>
                }
              </div>

              <!-- Pagamento e Total -->
              <div class="order-footer">
                <div class="pay-info">
                  <span class="pay-method">💳 {{ pedido.forma_pagamento | uppercase }}</span>
                  @if (pedido.troco_para) {
                    <span class="troco-info">Troco para: R$ {{ pedido.troco_para }}</span>
                  }
                </div>
                <div class="total-info">
                  <span class="total-label">Total</span>
                  <span class="total-val">{{ pedido.valor_total | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</span>
                </div>
              </div>

              <!-- Ações de Status da Cozinha e Despacho -->
              <div class="order-actions">
                @if (pedido.status !== 'entregue' && pedido.status !== 'cancelado') {<button class="btn btn-secondary btn-sm" (click)="abrirCancelamento(pedido)">Cancelar</button>}
                @if (pedido.status === 'pendente') {
                  <button class="btn btn-primary btn-sm full" (click)="alterarStatus(pedido, 'em_preparo')">
                    <app-icon nome="preparo"/> Iniciar Preparo na Cozinha
                  </button>
                }
                @if (pedido.status === 'em_preparo') {
                  <button
                    class="btn btn-warning btn-sm full dispatch-btn"
                    [disabled]="despachandoIds()[pedido.id]"
                    (click)="despacharParaEntrega(pedido)"
                  >
                    @if (despachandoIds()[pedido.id]) {
                      <app-icon nome="atualizar"/> Despachando & Notificando...
                    } @else {
                      <app-icon nome="entrega"/> Despachar (Notificar Cliente)
                    }
                  </button>
                }


                @if (pedido.status === 'saiu_para_entrega') {
                  <button class="btn btn-success btn-sm full" (click)="alterarStatus(pedido, 'entregue')">
                    <app-icon nome="confirmar"/> Confirmar Entrega
                  </button>
                }
                @if (pedido.status === 'entregue') {
                  <span class="delivered-msg">🎉 Pedido Concluído e Entregue</span>
                }
              </div>
            </div>
          } @empty {
            <div class="empty-state glass-card">
              <span class="empty-icon">📭</span>
              <h3>Nenhum pedido encontrado</h3>
              <p>Os novos pedidos recebidos no WhatsApp aparecerão aqui em tempo real.</p>
            </div>
          }
        </div>
      }

      <!-- 2. VISÃO EM LISTA (TABELA DETALHADA) -->
      @if (modoVisao() === 'lista') {
        <div class="table-container glass-card">
          <table class="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Horário</th>
                <th>Cliente</th>
                <th>Endereço / Bairro</th>
                <th>Itens do Pedido</th>
                <th>Pagamento</th>
                <th>Valor Total</th>
                <th>Status</th>
                <th>Ação Rápida</th>
              </tr>
            </thead>
            <tbody>
              @for (pedido of pedidos(); track pedido.id) {
                <tr [class.highlight-row]="pedido.status === 'em_preparo'">
                  <td class="code-cell">
                    <strong>{{ pedido.codigo_pedido }}</strong>
                  </td>
                  <td class="time-cell">
                    {{ pedido.created_at | date:'HH:mm • dd/MM' }}
                  </td>
                  <td>
                    <div class="client-cell">
                      <span class="client-name">{{ pedido.cliente?.nome || 'Cliente' }}</span>
                      <a [href]="'https://wa.me/' + pedido.cliente?.telefone" target="_blank" class="tel-link">
                        {{ pedido.cliente?.telefone }}
                      </a>
                    </div>
                  </td>
                  <td>
                    <div class="addr-cell">
                      <span>{{ pedido.endereco?.logradouro }}, {{ pedido.endereco?.numero }}</span>
                      <small class="bairro-tag">{{ pedido.endereco?.bairro }}</small>
                    </div>
                  </td>
                  <td>
                    <div class="items-cell">
                      @for (item of pedido.itens; track item.id) {
                        <div class="item-bullet">
                          • {{ item.quantidade }}x {{ item.nome_snapshot }} ({{ item.tamanho_snapshot }})
                        </div>
                      }
                    </div>
                  </td>
                  <td>
                    <span class="pay-badge">{{ pedido.forma_pagamento }}</span>
                    @if (pedido.troco_para) {
                      <div class="troco-tag">Tr. R$ {{ pedido.troco_para }}</div>
                    }
                  </td>
                  <td class="price-cell">
                    <strong>{{ pedido.valor_total | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</strong>
                  </td>
                  <td>
                    <app-pedido-status [status]="pedido.status" />
                  </td>
                  <td>
                    <div class="action-cell">
                      @if (pedido.status !== 'entregue' && pedido.status !== 'cancelado') {<button class="btn btn-secondary btn-sm" (click)="abrirCancelamento(pedido)">Cancelar</button>}
                @if (pedido.status === 'pendente') {
                        <button class="btn btn-primary btn-xs" (click)="alterarStatus(pedido, 'em_preparo')">
                          <app-icon nome="preparo"/> Preparar
                        </button>
                      }
                      @if (pedido.status === 'em_preparo') {
                        <button
                          class="btn btn-warning btn-xs"
                          [disabled]="despachandoIds()[pedido.id]"
                          (click)="despacharParaEntrega(pedido)"
                        >
                          @if (despachandoIds()[pedido.id]) {
                            <app-icon nome="atualizar"/> Despachando...
                          } @else {
                            <app-icon nome="entrega"/> Despachar
                          }
                        </button>
                      }


                      @if (pedido.status === 'saiu_para_entrega') {
                        <button class="btn btn-success btn-xs" (click)="alterarStatus(pedido, 'entregue')">
                          <app-icon nome="confirmar"/> Entregue
                        </button>
                      }
                      @if (pedido.status === 'entregue') {
                        <span class="delivered-mini">Concluído</span>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="9" class="empty-table-cell">
                    Nenhum pedido localizado no filtro selecionado.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styleUrls: ['../../shared/ui/page-actions.css'],
  styles: [`
    .cancelamento-dialog{position:fixed;inset:0;margin:auto;width:min(520px,calc(100vw - 32px));max-height:calc(100dvh - 32px);padding:0;border:1px solid var(--border-highlight);border-radius:var(--radius-lg);background:var(--bg-surface);color:var(--text-primary);box-shadow:0 24px 80px rgba(0,0,0,.45);overflow-y:auto}
    .cancelamento-dialog::backdrop{background:rgba(9,13,24,.75);backdrop-filter:blur(4px)}
    .cancelamento-form{padding:28px}.cancelamento-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.cancelamento-icon{display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:var(--danger-glow);color:var(--danger);font-size:28px}.cancelamento-fechar{border:0;background:transparent;color:var(--text-secondary);font-size:28px;width:36px;height:36px;cursor:pointer}.cancelamento-form h2{font-size:1.3rem}.cancelamento-form p{margin:8px 0 24px;color:var(--text-secondary);font-size:.875rem}.cancelamento-form label{display:block;margin-bottom:8px;font-weight:600;font-size:.875rem}.cancelamento-form textarea{display:block;width:100%;resize:vertical;padding:12px 14px;border:1px solid var(--border-highlight);border-radius:var(--radius-md);background:var(--bg-main);color:var(--text-primary);line-height:1.5;min-height:110px}.cancelamento-contador{display:block;text-align:right;color:var(--text-muted);margin-top:6px;font-size:.75rem}.cancelamento-footer{display:flex;justify-content:flex-end;gap:12px;margin-top:24px}.cancelamento-form .cancelamento-erro{color:var(--danger);margin:12px 0 0}@media(max-width:480px){.cancelamento-form{padding:20px}.cancelamento-footer{flex-direction:column-reverse}.cancelamento-footer button{width:100%}}

    .pedidos-page {
      display: flex;
      flex-direction: column;
      gap: 20px;
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
      line-height: 1.3;
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
      gap: 14px;
      flex-wrap: wrap;
    }

    /* Toggle de Visão */
    .view-toggle {
      display: flex;
      padding: 3px;
      gap: 3px;
      border-radius: var(--radius-sm);
    }

    .view-btn {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all var(--transition-fast);
    }

    .view-btn.active {
      background: var(--primary);
      color: #111827;
    }

    .status-filters {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .filter-pill {
      background: var(--bg-surface-elevated);
      color: var(--text-secondary);
      border: 1px solid var(--border-color);
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .filter-pill.active {
      background: var(--primary);
      color: #111827;
      border-color: var(--primary);
    }

    .search-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 18px;
    }

    .search-icon {
      font-size: 1.1rem;
    }

    .search-bar input {
      flex: 1;
      background: transparent;
      border: none;
      color: var(--text-primary);
      font-size: 0.9rem;
      font-family: var(--font-body);
      outline: none;
    }

    .refresh-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-color);
      color: var(--text-secondary);
      padding: 6px 12px;
      border-radius: var(--radius-sm);
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .refresh-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: var(--text-primary);
    }

    /* Grid de Cards */
    .orders-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 20px;
    }

    .order-card {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      transition: transform var(--transition-fast), border-color var(--transition-fast);
    }

    .order-card:hover {
      transform: translateY(-2px);
    }

    .order-card.highlight {
      border-color: rgba(59, 130, 246, 0.5);
      background: linear-gradient(180deg, rgba(59, 130, 246, 0.03) 0%, rgba(30, 41, 59, 0.6) 100%);
    }

    .order-card.in-delivery {
      border-color: rgba(245, 158, 11, 0.5);
      background: linear-gradient(180deg, rgba(245, 158, 11, 0.03) 0%, rgba(30, 41, 59, 0.6) 100%);
    }

    .order-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .order-id-group {
      display: flex;
      flex-direction: column;
    }

    .order-code {
      font-family: var(--font-heading);
      font-weight: 800;
      font-size: 1.05rem;
      color: var(--text-primary);
    }

    .order-time {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .order-customer-box {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .cust-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
    }

    .tel-link {
      color: #34D399;
      text-decoration: none;
      font-size: 0.775rem;
      font-weight: 600;
    }

    .addr-text {
      font-size: 0.775rem;
      color: var(--text-secondary);
    }

    .order-items-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 6px 0;
      border-top: 1px solid var(--border-color);
      border-bottom: 1px solid var(--border-color);
    }

    .order-item-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
    }

    .item-qty {
      font-weight: 700;
      color: var(--primary);
      margin-right: 6px;
    }

    .item-name {
      color: var(--text-primary);
    }

    .item-price {
      font-weight: 600;
      color: var(--text-secondary);
    }

    .order-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .pay-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .pay-method {
      font-size: 0.775rem;
      font-weight: 600;
      color: var(--text-muted);
    }

    .troco-info {
      font-size: 0.725rem;
      color: #FBBF24;
    }

    .total-info {
      text-align: right;
    }

    .total-label {
      font-size: 0.7rem;
      color: var(--text-muted);
      text-transform: uppercase;
      display: block;
    }

    .total-val {
      font-size: 1.25rem;
      font-weight: 800;
      color: #34D399;
    }

    .order-actions {
      display: flex;
      gap: 8px;
    }

    .full {
      width: 100%;
    }

    .dispatch-btn {
      background: var(--primary) !important;
      color: var(--on-primary) !important;
      font-weight: 700 !important;
      border: none !important;
    }

    .delivered-msg {
      font-size: 0.8rem;
      color: #34D399;
      font-weight: 600;
      text-align: center;
      width: 100%;
      padding: 6px;
      background: rgba(16, 185, 129, 0.08);
      border-radius: var(--radius-sm);
    }

    /* Tabela Detalhada (Visão em Lista) */
    .table-container {
      overflow-x: auto;
      border-radius: var(--radius-md);
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.85rem;
    }

    .data-table th {
      padding: 14px 16px;
      background: rgba(255, 255, 255, 0.03);
      color: var(--text-muted);
      font-weight: 600;
      border-bottom: 1px solid var(--border-color);
      white-space: nowrap;
    }

    .data-table td {
      padding: 14px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      vertical-align: middle;
    }

    .data-table tr:hover {
      background: rgba(255, 255, 255, 0.02);
    }

    .highlight-row {
      background: rgba(59, 130, 246, 0.04);
    }

    .code-cell {
      font-family: var(--font-heading);
      color: var(--text-primary);
    }

    .time-cell {
      color: var(--text-muted);
      font-size: 0.775rem;
      white-space: nowrap;
    }

    .client-cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .client-name {
      font-weight: 600;
      color: var(--text-primary);
    }

    .addr-cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
      max-width: 200px;
    }

    .bairro-tag {
      color: var(--primary);
      font-weight: 600;
    }

    .items-cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 0.8rem;
      max-width: 250px;
    }

    .item-bullet {
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .pay-badge {
      text-transform: uppercase;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-muted);
    }

    .troco-tag {
      font-size: 0.7rem;
      color: #FBBF24;
    }

    .price-cell {
      color: #34D399;
      font-size: 0.95rem;
      white-space: nowrap;
    }

    .action-cell {
      white-space: nowrap;
    }

    .btn-xs {
      padding: 6px 10px;
      font-size: 0.75rem;
      border-radius: var(--radius-sm);
      font-weight: 600;
    }

    .delivered-mini {
      color: #34D399;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .empty-table-cell {
      text-align: center;
      padding: 40px;
      color: var(--text-muted);
    }

    .empty-state {
      grid-column: 1 / -1;
      text-align: center;
      padding: 60px 20px;
    }

    .empty-icon {
      font-size: 3rem;
      margin-bottom: 12px;
      display: block;
    }

`]
})
export class PedidosComponent implements OnInit {
  cancelando = signal<Pedido | null>(null);
  motivoCancelamento = '';
  salvandoCancelamento = signal(false);
  erroCancelamento = signal<string | null>(null);
  @ViewChild('cancelamentoDialog') cancelamentoDialog!: ElementRef<HTMLDialogElement>;
  abrirCancelamento(pedido: Pedido) {
    this.cancelando.set(pedido);this.motivoCancelamento='';this.erroCancelamento.set(null);
    this.cancelamentoDialog.nativeElement.showModal();
    this.cancelamentoDialog.nativeElement.querySelector('textarea')?.focus();
  }
  fecharCancelamento(){if(this.salvandoCancelamento())return;this.cancelamentoDialog.nativeElement.close();this.cancelando.set(null);}
  aoCancelarDialog(event:Event){if(this.salvandoCancelamento()){event.preventDefault();return;}this.cancelando.set(null);}

  confirmarCancelamento() {
    const pedido=this.cancelando();const motivo=this.motivoCancelamento.trim();
    if(!pedido || !motivo || this.salvandoCancelamento()) return;
    this.salvandoCancelamento.set(true);
    this.api.updatePedidoStatus(pedido.id,'cancelado',motivo).subscribe({next:()=>{this.salvandoCancelamento.set(false);this.fecharCancelamento();this.carregarPedidos();this.api.getKpis().subscribe();},error:()=>{this.salvandoCancelamento.set(false);this.erroCancelamento.set('Não foi possível cancelar. Tente novamente.');}});
  }

  api = inject(ApiService);
  pedidos = signal<Pedido[]>([]);
  filtroStatus = signal<string>('');
  modoVisao = signal<'cards' | 'lista'>('cards');
  termoBusca: string = '';
  toastMensagem = signal<string | null>(null);
  despachandoIds = signal<Record<number, boolean>>({});

  ngOnInit() {
    this.carregarPedidos();
  }

  alternarVisao(modo: 'cards' | 'lista') {
    this.modoVisao.set(modo);
  }

  carregarPedidos() {
    this.api.getPedidos(this.filtroStatus(), this.termoBusca).subscribe((res) => {
      this.pedidos.set(res.data);
    });
  }

  filtrarStatus(status: string) {
    this.filtroStatus.set(status);
    this.carregarPedidos();
  }

  buscar() {
    this.carregarPedidos();
  }

  alterarStatus(pedido: Pedido, novoStatus: string) {
    this.api.updatePedidoStatus(pedido.id, novoStatus).subscribe(() => {
      this.carregarPedidos();
      this.api.getKpis().subscribe();
    });
  }

  despacharParaEntrega(pedido: Pedido) {
    // Trava de Idempotência: Bloqueia se já estiver processando ou se já estiver em rota
    if (this.despachandoIds()[pedido.id] || pedido.status === 'saiu_para_entrega') {
      return;
    }

    // Ativa estado de carregamento do botão imediatamente
    this.despachandoIds.update((m) => ({ ...m, [pedido.id]: true }));

    this.api.updatePedidoStatus(pedido.id, 'saiu_para_entrega').subscribe({
      next: (res) => {
        this.carregarPedidos();
        this.api.getKpis().subscribe();

        const mensagemNotificacao = res.notificacao_enviada
          ? `Pedido ${pedido.codigo_pedido} despachado. Cliente notificado pelo WhatsApp.`
          : `Pedido ${pedido.codigo_pedido} despachado. ${res.erro_notificacao || 'Envio da notificação não confirmado.'}`;
        this.toastMensagem.set(mensagemNotificacao);

        setTimeout(() => {
          this.toastMensagem.set(null);
        }, 6000);
      },
      error: () => {
        // Em caso de falha, libera o botão
        this.despachandoIds.update((m) => {
          const copy = { ...m };
          delete copy[pedido.id];
          return copy;
        });
      },
      complete: () => {
        // Libera a trava após 1.5s
        setTimeout(() => {
          this.despachandoIds.update((m) => {
            const copy = { ...m };
            delete copy[pedido.id];
            return copy;
          });
        }, 1500);
      }
    });
  }


}
