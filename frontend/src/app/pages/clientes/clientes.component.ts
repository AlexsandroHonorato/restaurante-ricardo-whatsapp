import { IconComponent } from '../../shared/ui/icon.component';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { Cliente } from '../../core/models/dashboard.model';
import { PaginacaoComponent } from '../../shared/ui/paginacao.component';
import { Subscription } from 'rxjs';
import { ConfirmacaoService } from '../../shared/ui/confirmacao.service';

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [IconComponent, CommonModule, FormsModule, PaginacaoComponent],
  templateUrl: './clientes.component.html',
  styleUrls: ['../../shared/ui/page-actions.css', './clientes.component.css'],
})
export class ClientesComponent implements OnInit {
  api = inject(ApiService);
  private auth = inject(AuthService);
  private confirmacao = inject(ConfirmacaoService);
  clientes = signal<Cliente[]>([]);
  termoBusca: string = '';
  podeExcluir = computed(() => this.auth.pode('clientes', 'excluir'));
  apagando = signal<number | null>(null);
  mensagem = signal('');

  /** LGPD: a pedido do cliente. Os pedidos continuam no faturamento, sem identificar a pessoa. */
  apagarDados(c: Cliente) {
    if (this.apagando()) return;
    this.confirmacao.pedir(
      {
        titulo: 'Apagar dados do cliente?',
        mensagem:
          `Nome, telefone, endereços e conversas de ${c.nome} serão removidos definitivamente. ` +
          'Os pedidos continuam no faturamento, sem identificação.',
        confirmar: 'Apagar dados',
        perigo: true,
      },
      () => this.apagarConfirmado(c),
    );
  }
  private apagarConfirmado(c: Cliente) {
    if (this.apagando()) return;
    this.apagando.set(c.id);
    this.api.anonimizarCliente(c.id).subscribe({
      next: () => {
        this.apagando.set(null);
        this.mensagem.set(`Dados pessoais de ${c.nome} removidos.`);
        this.carregarClientes();
      },
      error: () => {
        this.apagando.set(null);
        this.mensagem.set('Não foi possível apagar os dados agora. Tente novamente.');
      },
    });
  }

  ngOnInit() {
    this.carregarClientes();
  }

  pagina = signal(1);
  ultimaPagina = signal(1);
  totalClientes = signal(0);
  erroLista = signal<string | null>(null);
  private consulta?: Subscription;

  carregarClientes() {
    this.consulta?.unsubscribe();
    this.consulta = this.api.getClientes(this.termoBusca, this.pagina()).subscribe({
      next: (res) => {
        if (res.current_page > res.last_page) return this.irParaPagina(res.last_page);
        this.erroLista.set(null);
        this.clientes.set(res.data);
        this.ultimaPagina.set(res.last_page);
        this.totalClientes.set(res.total);
      },
      error: () =>
        this.erroLista.set(
          'Não foi possível carregar os clientes. A lista abaixo pode estar desatualizada.',
        ),
    });
  }

  irParaPagina(pagina: number) {
    this.pagina.set(pagina);
    this.carregarClientes();
  }

  buscar() {
    this.irParaPagina(1);
  }
}
