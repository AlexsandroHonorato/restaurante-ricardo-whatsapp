import { Component, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { API_BASE } from '../../core/services/session-state';

interface FichaEmpresa {
  nome: string;
  tipo_negocio: 'restaurante' | 'loja';
  telefone: string | null;
  telefone_2: string | null;
  endereco: string | null;
  quem_somos: string | null;
  formas_pagamento: string | null;
  politicas: string | null;
}

/** Dados que o bot usa para se apresentar e responder dúvidas (antes só editáveis no arquivo negocio.md). */
@Component({
  selector: 'app-empresa',
  imports: [FormsModule],
  templateUrl: './empresa.component.html',
  styleUrl: './empresa.component.css',
})
export class EmpresaComponent {
  private http = inject(HttpClient);
  form: FichaEmpresa = {
    nome: '',
    tipo_negocio: 'restaurante',
    telefone: null,
    telefone_2: null,
    endereco: null,
    quem_somos: null,
    formas_pagamento: null,
    politicas: null,
  };
  carregando = signal(true);
  salvando = signal(false);
  mensagem = signal('');
  erros = signal<string[]>([]);

  constructor() {
    this.http.get<FichaEmpresa>(`${API_BASE}/empresa`).subscribe({
      next: (ficha) => {
        this.form = { ...this.form, ...ficha, nome: ficha.nome ?? '' };
        this.carregando.set(false);
      },
      error: () => {
        this.carregando.set(false);
        this.erros.set(['Não foi possível carregar os dados da empresa.']);
      },
    });
  }

  salvar() {
    if (this.salvando()) return;
    this.salvando.set(true);
    this.mensagem.set('');
    this.erros.set([]);
    const {
      nome,
      tipo_negocio,
      telefone,
      telefone_2,
      endereco,
      quem_somos,
      formas_pagamento,
      politicas,
    } = this.form;
    this.http
      .put<FichaEmpresa>(`${API_BASE}/empresa`, {
        nome,
        tipo_negocio,
        telefone,
        telefone_2,
        endereco,
        quem_somos,
        formas_pagamento,
        politicas,
      })
      .subscribe({
        next: () => {
          this.salvando.set(false);
          this.mensagem.set('Dados salvos. O bot passa a usá-los na próxima mensagem.');
        },
        error: (erro: HttpErrorResponse) => {
          this.salvando.set(false);
          const detalhes =
            erro.status === 422 ? Object.values<string[]>(erro.error?.errors ?? {}).flat() : [];
          this.erros.set(
            detalhes.length ? detalhes : ['Não foi possível salvar. Tente novamente.'],
          );
        },
      });
  }
}
