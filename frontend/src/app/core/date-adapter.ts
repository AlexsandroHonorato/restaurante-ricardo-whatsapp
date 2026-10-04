import { Injectable } from '@angular/core';
import { NativeDateAdapter } from '@angular/material/core';
import { MatDatepickerIntl } from '@angular/material/datepicker';

export function calendarioPortugues() {
  const textos = new MatDatepickerIntl();
  Object.assign(textos, {
    calendarLabel: 'Calendário',
    openCalendarLabel: 'Abrir calendário',
    closeCalendarLabel: 'Fechar calendário',
    prevMonthLabel: 'Mês anterior',
    nextMonthLabel: 'Próximo mês',
    prevYearLabel: 'Ano anterior',
    nextYearLabel: 'Próximo ano',
    prevMultiYearLabel: 'Anos anteriores',
    nextMultiYearLabel: 'Próximos anos',
    switchToMonthViewLabel: 'Escolher dia',
    switchToMultiYearViewLabel: 'Escolher mês e ano',
  });
  return textos;
}

@Injectable()
export class DataBrasileiraAdapter extends NativeDateAdapter {
  override parse(valor: unknown): Date | null {
    if (typeof valor !== 'string') return valor instanceof Date ? valor : null;
    if (!valor.trim()) return null;
    const partes = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(valor.trim());
    if (!partes) return new Date(NaN);
    const [, dia, mes, ano] = partes.map(Number);
    const data = new Date(ano, mes - 1, dia);
    return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia
      ? data
      : new Date(NaN);
  }
}
