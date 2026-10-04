import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { PedidosRecentesComponent } from './pedidos-recentes.component';
describe('Pedidos recentes com dados reais', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [PedidosRecentesComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }),
  );
  it('informa falha sem criar pedidos e permite retentar', () => {
    const f = TestBed.createComponent(PedidosRecentesComponent);
    const c = f.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    f.componentRef.setInput('atualizacao', 0);
    f.detectChanges();
    http
      .expectOne('http://localhost:8080/api/pedidos?per_page=5')
      .flush({}, { status: 503, statusText: 'Indisponivel' });
    f.detectChanges();
    expect(c.pedidos()).toEqual([]);
    expect(f.nativeElement.textContent).toContain('Não foi possível');
    c.carregar();
    http.expectOne('http://localhost:8080/api/pedidos?per_page=5').flush({ data: [] });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Nenhum pedido recebido.');
    http.verify();
  });
  it('cancela consulta anterior ao atualizar e ao desmontar', () => {
    const f = TestBed.createComponent(PedidosRecentesComponent);
    const c = f.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    f.componentRef.setInput('atualizacao', 0);
    f.detectChanges();
    const primeira = http.expectOne('http://localhost:8080/api/pedidos?per_page=5');
    c.carregar();
    expect(primeira.cancelled).toBe(true);
    const segunda = http.expectOne('http://localhost:8080/api/pedidos?per_page=5');
    f.destroy();
    expect(segunda.cancelled).toBe(true);
    http.verify();
  });
});
