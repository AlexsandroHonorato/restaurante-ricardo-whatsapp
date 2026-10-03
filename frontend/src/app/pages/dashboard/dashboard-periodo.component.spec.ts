import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DashboardComponent } from './dashboard.component';

describe('Filtro do dashboard', () => {
  beforeEach(() => TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  }));

  it('envia o período a todos os gráficos e cancela respostas antigas', () => {
    const componente = TestBed.runInInjectionContext(() => new DashboardComponent());
    const http = TestBed.inject(HttpTestingController);
    componente.setDias(30);
    const antigos = http.match(request => request.urlWithParams.includes('dias=30'));
    expect(antigos.length).toBe(4);
    componente.setDias(7);
    expect(antigos.every(request => request.cancelled)).toBe(true);
    const atuais = http.match(request => request.urlWithParams.includes('dias=7'));
    expect(atuais.length).toBe(4);
    atuais.forEach(request => request.flush([]));
    expect(componente.diasGrafico()).toBe(7);
    componente.ngOnDestroy();
    http.verify();
  });
});
