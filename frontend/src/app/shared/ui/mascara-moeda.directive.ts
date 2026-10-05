import { Directive, ElementRef, HostListener, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** Centavos no formato brasileiro: 3000 → "30,00"; 123456 → "1.234,56". */
export function mascararMoeda(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Só os dígitos contam e entram pela direita, como em maquininha: "3", "30", "300" → 0,03 · 0,30 · 3,00. */
export function centavosDigitados(texto: string): number {
  return Number(texto.replace(/\D/g, '').slice(0, 9));
}

/**
 * Campo de valor em reais: mostra "1.234,56" enquanto digita e mantém o ngModel como número (1234.56).
 * Use em <input type="text" inputmode="numeric">.
 */
@Directive({
  selector: 'input[appMascaraMoeda]',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MascaraMoedaDirective),
      multi: true,
    },
  ],
})
export class MascaraMoedaDirective implements ControlValueAccessor {
  private campo = inject(ElementRef<HTMLInputElement>).nativeElement as HTMLInputElement;
  private aoMudar: (valor: number) => void = () => {};
  private aoTocar: () => void = () => {};

  writeValue(valor: number | string | null): void {
    const numero = Number(valor);
    this.campo.value = mascararMoeda(Number.isFinite(numero) ? Math.round(numero * 100) : 0);
  }

  registerOnChange(funcao: (valor: number) => void): void {
    this.aoMudar = funcao;
  }

  registerOnTouched(funcao: () => void): void {
    this.aoTocar = funcao;
  }

  setDisabledState(desabilitado: boolean): void {
    this.campo.disabled = desabilitado;
  }

  @HostListener('input')
  digitar() {
    const centavos = centavosDigitados(this.campo.value);
    this.campo.value = mascararMoeda(centavos);
    this.aoMudar(centavos / 100);
  }

  @HostListener('blur')
  sair() {
    this.aoTocar();
  }
}
