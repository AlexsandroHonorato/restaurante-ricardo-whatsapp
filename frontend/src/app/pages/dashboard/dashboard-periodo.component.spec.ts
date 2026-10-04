import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DashboardComponent } from './dashboard.component';

describe('Filtro do dashboard', () => {
  it('aplica datas de outro mês a todos os gráficos e restaura o atalho', () => {
    const componente = TestBed.runInInjectionContext(() => new DashboardComponent());
    const http = TestBed.inject(HttpTestingController);
    componente.datas.setValue({ inicio: new Date(2026, 7, 1), fim: new Date(2026, 7, 31) });
    componente.aplicarDatas();
    const consultas = http.match((r) =>
      r.urlWithParams.includes('data_inicio=2026-08-01&data_fim=2026-08-31'),
    );
    expect(consultas.length).toBe(4);
    consultas.forEach((r) => r.flush([]));
    expect(componente.rotuloPeriodo()).toBe('01/08/2026 a 31/08/2026');
    componente.setDias(7);
    expect(componente.periodo()).toBeNull();
    http.match((r) => r.urlWithParams.includes('dias=7')).forEach((r) => r.flush([]));
    componente.ngOnDestroy();
    http.verify();
  });
  it('rejeita intervalos acima de 365 dias sem enviar consultas', () => {
    const componente = TestBed.runInInjectionContext(() => new DashboardComponent());
    componente.datas.setValue({ inicio: new Date(2025, 0, 1), fim: new Date(2026, 1, 1) });
    componente.aplicarDatas();
    expect(componente.erroDatas()).toContain('365');
    expect(componente.periodo()).toBeNull();
    TestBed.inject(HttpTestingController).verify();
    componente.ngOnDestroy();
  });
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }),
  );

  it('envia o período a todos os gráficos e cancela respostas antigas', () => {
    const componente = TestBed.runInInjectionContext(() => new DashboardComponent());
    const http = TestBed.inject(HttpTestingController);
    componente.setDias(30);
    const antigos = http.match((request) => request.urlWithParams.includes('dias=30'));
    expect(antigos.length).toBe(4);
    componente.setDias(7);
    expect(antigos.every((request) => request.cancelled)).toBe(true);
    const atuais = http.match((request) => request.urlWithParams.includes('dias=7'));
    expect(atuais.length).toBe(4);
    atuais.forEach((request) => request.flush([]));
    expect(componente.diasGrafico()).toBe(7);
    componente.ngOnDestroy();
    http.verify();
  });
});
