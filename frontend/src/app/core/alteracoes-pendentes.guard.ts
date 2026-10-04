import { CanDeactivateFn } from '@angular/router';

export interface ComAlteracoesPendentes {
  temAlteracoesPendentes(): boolean;
}

/** Pede confirmação antes de sair de uma tela com alterações não salvas. */
export const confirmarSaidaSemSalvar: CanDeactivateFn<ComAlteracoesPendentes> = (tela) =>
  !tela.temAlteracoesPendentes() ||
  confirm('Há alterações não salvas nesta tela. Sair mesmo assim?');
