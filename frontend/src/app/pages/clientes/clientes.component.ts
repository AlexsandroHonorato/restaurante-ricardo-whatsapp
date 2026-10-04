import { IconComponent } from '../../shared/ui/icon.component';
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { Cliente } from '../../core/models/dashboard.model';

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [IconComponent, CommonModule, FormsModule],
  templateUrl: './clientes.component.html',
  styleUrls: ['../../shared/ui/page-actions.css', './clientes.component.css'],
})
export class ClientesComponent implements OnInit {
  api = inject(ApiService);
  clientes = signal<Cliente[]>([]);
  termoBusca: string = '';

  ngOnInit() {
    this.carregarClientes();
  }

  carregarClientes() {
    this.api.getClientes(this.termoBusca).subscribe((res) => {
      this.clientes.set(res.data);
    });
  }

  buscar() {
    this.carregarClientes();
  }
}
