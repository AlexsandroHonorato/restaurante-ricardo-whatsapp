import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { HorarioAtendimento } from '../../core/models/dashboard.model';
import { ConfirmacaoService } from '../../shared/ui/confirmacao.service';

interface DiaEditavel extends HorarioAtendimento {
  salvando: boolean;
  erro: string | null;
  sucesso: string | null;
}

@Component({
  selector: 'app-configuracoes',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './configuracoes.component.html',
  styleUrl: './configuracoes.component.css',
})
export class ConfiguracoesComponent implements OnInit {
  private api = inject(ApiService);
  private confirmacao = inject(ConfirmacaoService);
  private originais = new Map<number, string>();
  dias = signal<DiaEditavel[]>([]);
  carregando = signal(false);
  erro = signal<string | null>(null);
  fuso = signal('America/Sao_Paulo');

  ngOnInit() {
    this.carregar();
  }

  carregar() {
    this.carregando.set(true);
    this.erro.set(null);
    this.api
      .getHorariosAtendimento()
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({
        next: (res) => {
          this.fuso.set(res.fuso);
          this.dias.set(
            res.horarios.map((h) => {
              const dia = this.normalizar(h);
              this.originais.set(dia.dia_semana, this.assinatura(dia));
              return dia;
            }),
          );
        },
        error: () =>
          this.erro.set(
            'Não foi possível carregar os horários. Verifique a conexão com a API e tente novamente.',
          ),
      });
  }

  alterarAtivo(dia: DiaEditavel, ativo: boolean) {
    this.editar(dia.dia_semana, {
      ativo,
      hora_inicio: ativo ? dia.hora_inicio || '11:00' : null,
      hora_fim: ativo ? dia.hora_fim || '14:30' : null,
    });
  }

  alterarHora(dia: DiaEditavel, campo: 'hora_inicio' | 'hora_fim', valor: string) {
    this.editar(dia.dia_semana, { [campo]: valor });
  }

  alterado(dia: DiaEditavel): boolean {
    return this.assinatura(dia) !== this.originais.get(dia.dia_semana);
  }

  validacao(dia: DiaEditavel): string | null {
    if (!dia.ativo) return null;
    if (!dia.hora_inicio || !dia.hora_fim) return 'Informe a hora de início e de fim.';
    if (dia.hora_fim <= dia.hora_inicio) return 'A hora de fim deve ser posterior ao início.';
    return null;
  }

  salvar(dia: DiaEditavel) {
    if (dia.salvando || !this.alterado(dia)) return;
    const erro = this.validacao(dia);
    if (erro) {
      this.editar(dia.dia_semana, { erro });
      return;
    }
    this.confirmacao.pedir(
      {
        titulo: 'Salvar horário?',
        mensagem: dia.ativo
          ? `${dia.nome_dia}: atendimento das ${dia.hora_inicio} às ${dia.hora_fim}. O bot passa a seguir este horário.`
          : `${dia.nome_dia} ficará fechado. O bot não atenderá neste dia.`,
        confirmar: 'Salvar horário',
      },
      () => this.salvarConfirmado(dia),
    );
  }

  private salvarConfirmado(dia: DiaEditavel) {
    if (this.dias().find((d) => d.dia_semana === dia.dia_semana)?.salvando) return;
    this.editar(dia.dia_semana, { salvando: true });
    this.api
      .atualizarHorarioAtendimento(dia.dia_semana, {
        ativo: dia.ativo,
        hora_inicio: dia.ativo ? dia.hora_inicio : null,
        hora_fim: dia.ativo ? dia.hora_fim : null,
      })
      .pipe(
        finalize(() => {
          this.dias.update((dias) =>
            dias.map((d) => (d.dia_semana === dia.dia_semana ? { ...d, salvando: false } : d)),
          );
        }),
      )
      .subscribe({
        next: (res) => {
          const salvo = this.normalizar(res.horario);
          this.originais.set(salvo.dia_semana, this.assinatura(salvo));
          this.dias.update((dias) =>
            dias.map((d) =>
              d.dia_semana === salvo.dia_semana ? { ...salvo, sucesso: 'Horário salvo.' } : d,
            ),
          );
        },
        error: (err: HttpErrorResponse) => {
          const mensagens = err.error?.errors;
          const mensagem = mensagens
            ? Object.values(mensagens).flat().join(' ')
            : 'Não foi possível salvar. Suas alterações foram mantidas; tente novamente.';
          this.editar(dia.dia_semana, { erro: mensagem });
        },
      });
  }

  private editar(numero: number, dados: Partial<DiaEditavel>) {
    this.dias.update((dias) =>
      dias.map((d) =>
        d.dia_semana === numero ? { ...d, erro: null, sucesso: null, ...dados } : d,
      ),
    );
  }

  private normalizar(horario: HorarioAtendimento): DiaEditavel {
    return {
      ...horario,
      hora_inicio: horario.hora_inicio?.slice(0, 5) || null,
      hora_fim: horario.hora_fim?.slice(0, 5) || null,
      salvando: false,
      erro: null,
      sucesso: null,
    };
  }

  private assinatura(dia: HorarioAtendimento): string {
    return JSON.stringify([
      dia.ativo,
      dia.ativo ? dia.hora_inicio : null,
      dia.ativo ? dia.hora_fim : null,
    ]);
  }
}
