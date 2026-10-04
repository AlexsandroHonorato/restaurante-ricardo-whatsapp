import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ConfiguracoesComponent } from './configuracoes.component';

const baseUrl = 'http://localhost:8080/api/horarios-atendimento';
const segunda = { id: 1, dia_semana: 1, nome_dia: 'Segunda-feira', ativo: true, hora_inicio: '11:00:00', hora_fim: '14:30:00' };

describe('Configurações de atendimento', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ConfiguracoesComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  function carregar() {
    const fixture = TestBed.createComponent(ConfiguracoesComponent);
    fixture.detectChanges();
    http.expectOne(baseUrl).flush({ fuso: 'America/Sao_Paulo', horarios: [segunda] });
    fixture.detectChanges();
    return fixture;
  }

  it('normaliza horários, bloqueia envio repetido e confirma persistência', () => {
    const fixture = carregar();
    const component = fixture.componentInstance;
    expect(component.dias()[0].hora_inicio).toBe('11:00');
    component.alterarHora(component.dias()[0], 'hora_inicio', '10:30');
    component.salvar(component.dias()[0]);
    component.salvar(component.dias()[0]);
    const request = http.expectOne(`${baseUrl}/1`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ ativo: true, hora_inicio: '10:30', hora_fim: '14:30' });
    request.flush({ horario: { ...segunda, hora_inicio: '10:30:00' } });
    expect(component.dias()[0].salvando).toBe(false);
    expect(component.alterado(component.dias()[0])).toBe(false);
    expect(component.dias()[0].sucesso).toBe('Horário salvo.');
  });

  it('preserva edição quando a API falha e permite tentar novamente', () => {
    const component = carregar().componentInstance;
    component.alterarHora(component.dias()[0], 'hora_fim', '15:00');
    component.salvar(component.dias()[0]);
    http.expectOne(`${baseUrl}/1`).flush({}, { status: 500, statusText: 'Error' });
    expect(component.dias()[0].hora_fim).toBe('15:00');
    expect(component.dias()[0].salvando).toBe(false);
    expect(component.dias()[0].erro).toBeTruthy();
    expect(component.alterado(component.dias()[0])).toBe(true);
  });

  it('recusa intervalo inválido e salva dia fechado sem horários', () => {
    const component = carregar().componentInstance;
    component.alterarHora(component.dias()[0], 'hora_fim', '10:00');
    component.salvar(component.dias()[0]);
    http.expectNone(`${baseUrl}/1`);
    expect(component.dias()[0].erro).toContain('posterior');
    component.alterarAtivo(component.dias()[0], false);
    component.salvar(component.dias()[0]);
    const request = http.expectOne(`${baseUrl}/1`);
    expect(request.request.body).toEqual({ ativo: false, hora_inicio: null, hora_fim: null });
    request.flush({ horario: { ...segunda, ativo: false, hora_inicio: null, hora_fim: null } });
  });

  it('informa falha no carregamento e oferece nova tentativa', () => {
    const fixture = TestBed.createComponent(ConfiguracoesComponent);
    fixture.detectChanges();
    http.expectOne(baseUrl).flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Tentar novamente');
    expect(fixture.componentInstance.carregando()).toBe(false);
  });
});
