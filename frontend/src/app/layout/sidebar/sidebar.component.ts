import { AuthService } from '../../core/services/auth.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { BrandSymbolComponent } from '../../shared/brand/brand-symbol.component';
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { TransbordoService } from '../../core/services/transbordo.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, IconComponent, BrandSymbolComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent {
  configuracoesAbertas = true;
  api = inject(ApiService);
  auth = inject(AuthService);
  // Contador de Atendimentos = clientes aguardando atendimento humano agora (o mesmo do sino do cabeçalho).
  transbordo = inject(TransbordoService);
}
