import { Directive, ElementRef, HostListener, inject } from '@angular/core';
import { NgControl } from '@angular/forms';

/** Formata telefone brasileiro: (12) 3333-4444 (fixo, 10 dígitos) ou (12) 99999-9999 (celular, 11). */
export function mascararTelefone(valor: string | null | undefined): string {
  let d = (valor ?? '').replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2); // colado com o código do país
  d = d.slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return `(${d}`;
  const meio = d.length === 11 ? 5 : 4;
  const fim = d.slice(2 + meio);
  return `(${d.slice(0, 2)}) ${d.slice(2, 2 + meio)}${fim ? '-' + fim : ''}`;
}

/** Aplica `mascararTelefone` enquanto digita ou cola, mantendo o ngModel com o valor formatado. */
@Directive({ selector: 'input[appMascaraTelefone]', standalone: true })
export class MascaraTelefoneDirective {
  private campo = inject(ElementRef<HTMLInputElement>).nativeElement as HTMLInputElement;
  private controle = inject(NgControl, { optional: true });

  @HostListener('input')
  formatar() {
    const formatado = mascararTelefone(this.campo.value);
    if (formatado === this.campo.value) return;
    this.campo.value = formatado;
    // Atualiza controle e ngModel, seja qual for a ordem em relação ao listener do próprio ngModel.
    this.controle?.control?.setValue(formatado, { emitModelToViewChange: false });
    this.controle?.viewToModelUpdate(formatado);
  }
}
