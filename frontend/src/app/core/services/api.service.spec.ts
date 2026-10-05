import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiService } from './api.service';

describe('ApiService', () => {
  let api: ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('keeps the last KPI values and reports failure without fabricated sales', () => {
    let emitted = false;
    api.getKpis().subscribe(() => (emitted = true));
    expect(api.loading()).toBe(true);
    http
      .expectOne('http://localhost:8080/api/dashboard/kpis')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect(api.loading()).toBe(false);
    expect(api.kpis()).toBeNull();
    expect(api.erro()).toBeTruthy();
    expect(emitted).toBe(false);
  });

  it('does not replace operational orders with an empty success on failure', () => {
    let emitted = false;
    let falhou = false;
    api.getPedidos('em_preparo', 'Ana', 2).subscribe({
      next: () => (emitted = true),
      error: () => (falhou = true),
    });
    http
      .expectOne('http://localhost:8080/api/pedidos?page=2&status=em_preparo&busca=Ana')
      .flush({}, { status: 500, statusText: 'Error' });
    expect(emitted).toBe(false);
    expect(falhou).toBe(true);
  });
});
