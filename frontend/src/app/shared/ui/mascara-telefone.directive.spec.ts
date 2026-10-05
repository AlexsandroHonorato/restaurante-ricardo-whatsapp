import { mascararTelefone } from './mascara-telefone.directive';

describe('mascararTelefone', () => {
  it.each([
    ['', ''],
    ['1', '(1'],
    ['12', '(12'],
    ['123', '(12) 3'],
    ['1233334444', '(12) 3333-4444'],
    ['12997500045', '(12) 99750-0045'],
    ['12 9 9750-0045 999', '(12) 99750-0045'],
    ['+55 (12) 99750-0045', '(12) 99750-0045'],
    ['abc', ''],
  ])('%s → %s', (entrada, saida) => {
    expect(mascararTelefone(entrada)).toBe(saida);
  });
});
