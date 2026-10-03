import { TestBed } from '@angular/core/testing';
import { DataBrasileiraAdapter } from './date-adapter';

describe('Datas brasileiras', () => {
  it('interpreta DD/MM/AAAA e rejeita dias inexistentes', () => {
    const adapter = TestBed.runInInjectionContext(() => new DataBrasileiraAdapter());
    const data = adapter.parse('31/08/2026')!;
    expect(data.getFullYear()).toBe(2026);
    expect(data.getMonth()).toBe(7);
    expect(data.getDate()).toBe(31);
    expect(Number.isNaN(adapter.parse('31/02/2026')!.getTime())).toBe(true);
    expect(Number.isNaN(adapter.parse('08-31-2026')!.getTime())).toBe(true);
  });
});
