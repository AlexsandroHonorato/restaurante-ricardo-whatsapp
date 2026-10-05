import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { MascaraMoedaDirective, centavosDigitados, mascararMoeda } from './mascara-moeda.directive';

@Component({
  imports: [FormsModule, MascaraMoedaDirective],
  template: `<input type="text" name="preco" [(ngModel)]="preco" appMascaraMoeda />`,
})
class CampoDeTeste {
  preco = 30;
}

describe('Máscara de moeda', () => {
  it.each([
    [0, '0,00'],
    [3, '0,03'],
    [3000, '30,00'],
    [123456, '1.234,56'],
  ])('%s centavos → %s', (centavos, texto) => {
    expect(mascararMoeda(centavos)).toBe(texto);
  });

  it('só os dígitos contam', () => {
    expect(centavosDigitados('R$ 1.234,56')).toBe(123456);
    expect(centavosDigitados('abc')).toBe(0);
  });

  it('mostra o valor formatado e mantém o ngModel como número', async () => {
    const fixture = TestBed.createComponent(CampoDeTeste);
    fixture.detectChanges();
    await fixture.whenStable();
    const campo = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(campo.value).toBe('30,00');

    campo.value = '30,005'; // digitou "5" no fim
    campo.dispatchEvent(new Event('input'));
    expect(campo.value).toBe('300,05');
    expect(fixture.componentInstance.preco).toBe(300.05);

    campo.value = 'x';
    campo.dispatchEvent(new Event('input'));
    expect(campo.value).toBe('0,00');
    expect(fixture.componentInstance.preco).toBe(0);
  });
});
