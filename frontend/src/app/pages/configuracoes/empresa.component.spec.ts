import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EmpresaComponent } from './empresa.component';
import { API_BASE } from '../../core/services/session-state';
import { ConfirmacaoService } from '../../shared/ui/confirmacao.service';

const FICHA = {
  nome: 'Restaurante Família Ricardo',
  tipo_negocio: 'restaurante',
  telefone: '(12) 99750-0045',
  telefone_2: null,
  endereco: 'Av. Irineu, 1531',
  quem_somos: 'Comida caseira.',
  formas_pagamento: '- Pix',
  politicas: null,
  minutos_mensagem_antiga: 5,
  minutos_fila_acumulada: 2,
};

function montar() {
  TestBed.configureTestingModule({
    imports: [EmpresaComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      // Modal de decisão confirma na hora.
      {
        provide: ConfirmacaoService,
        useValue: { pedir: (_: unknown, aoConfirmar: () => void) => aoConfirmar() },
      },
    ],
  });
  const fixture = TestBed.createComponent(EmpresaComponent);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  http.expectOne(`${API_BASE}/empresa`).flush(FICHA);
  fixture.detectChanges();
  return { fixture, http, el: fixture.nativeElement as HTMLElement, c: fixture.componentInstance };
}

describe('Dados da empresa', () => {
  it('carrega a ficha nos campos e salva somente o que o formulário tem', async () => {
    const { fixture, http, el, c } = montar();
    await fixture.whenStable();
    expect((el.querySelector('#empresa-nome') as HTMLInputElement).value).toBe(
      'Restaurante Família Ricardo',
    );
    c.form.nome = 'Família Ricardo Delivery';
    c.salvar();
    c.salvar();
    const req = http.expectOne({ method: 'PUT', url: `${API_BASE}/empresa` });
    expect(req.request.body).toEqual({ ...FICHA, nome: 'Família Ricardo Delivery' });
    req.flush({ ...FICHA, nome: 'Família Ricardo Delivery' });
    fixture.detectChanges();
    expect(el.querySelector('[role="status"]')?.textContent).toContain('Dados salvos');
    http.verify();
  });

  it('telefones recebem máscara ao carregar e enquanto digita', async () => {
    TestBed.configureTestingModule({
      imports: [EmpresaComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(EmpresaComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(`${API_BASE}/empresa`).flush({ ...FICHA, telefone: '5512997500045' });
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect((el.querySelector('#empresa-telefone') as HTMLInputElement).value).toBe(
      '(12) 99750-0045',
    );
    const alternativo = el.querySelector('#empresa-telefone2') as HTMLInputElement;
    alternativo.value = '1233334444';
    alternativo.dispatchEvent(new Event('input'));
    expect(alternativo.value).toBe('(12) 3333-4444');
    expect(fixture.componentInstance.form.telefone_2).toBe('(12) 3333-4444');
  });

  it('mostra os erros de validação da API e mantém o que foi digitado', () => {
    const { fixture, http, el, c } = montar();
    c.form.telefone = 'liga pra mim';
    c.salvar();
    http
      .expectOne(`${API_BASE}/empresa`)
      .flush(
        { message: 'erro', errors: { telefone: ['O campo telefone tem um formato inválido.'] } },
        { status: 422, statusText: 'Unprocessable' },
      );
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('formato inválido');
    expect(c.form.telefone).toBe('liga pra mim');
    expect(c.salvando()).toBe(false);
    http.verify();
  });
});
