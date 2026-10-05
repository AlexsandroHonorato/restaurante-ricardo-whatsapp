import { TestBed } from '@angular/core/testing';
import { of, EMPTY } from 'rxjs';
import { vi } from 'vitest';
import { ApiService } from './api.service';
import { TransbordoService } from './transbordo.service';

describe('Avisos de transbordo', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });
  it('período do monitor: troca consulta na hora e volta a 24 h ao sair', async () => {
    vi.useFakeTimers();
    const consultar = vi.fn(() => of([]));
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: { getStatusConversas: consultar } }],
    });
    const service = TestBed.inject(TransbordoService);
    service.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    expect(consultar).toHaveBeenLastCalledWith(24);
    service.mudarPeriodo(168);
    await vi.advanceTimersByTimeAsync(0);
    expect(consultar).toHaveBeenLastCalledWith(168);
    await vi.advanceTimersByTimeAsync(5000);
    expect(consultar).toHaveBeenLastCalledWith(168);
    service.parar();
    expect(service.periodoHoras()).toBe(24);
  });
  it('reduz cinco avisos para quatro após contato confirmado e mantém após nova consulta', async () => {
    vi.useFakeTimers();
    let dados = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      status_atual: 'transbordo_humano',
      contato_iniciado_em: null as string | null,
    }));
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: { getStatusConversas: () => of(dados) } }],
    });
    const service = TestBed.inject(TransbordoService);
    service.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    expect(service.aguardando()).toBe(5);
    service.assumir(3);
    expect(service.aguardando()).toBe(4);
    expect(service.alertas().some((s) => s.id === 3)).toBe(false);
    dados = dados.map((s) =>
      s.id === 3 ? { ...s, contato_iniciado_em: new Date().toISOString() } : s,
    );
    await vi.advanceTimersByTimeAsync(5000);
    expect(service.aguardando()).toBe(4);
    service.mostrarAlertas();
    expect(service.alertas()).toHaveLength(4);
  });
  it('conta pendentes sem alertar histórico e avisa só entrada ou retorno ao transbordo', async () => {
    vi.useFakeTimers();
    let dados = [{ id: 1, status_atual: 'transbordo_humano' }];
    let falha = false;
    const consultar = vi.fn(() => (falha ? EMPTY : of(dados)));
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: { getStatusConversas: consultar } }],
    });
    const service = TestBed.inject(TransbordoService);
    service.iniciar();
    service.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    expect(consultar).toHaveBeenCalledTimes(1);
    expect(service.aguardando()).toBe(1);
    expect(service.eventos()).toBe(0);
    dados = [...dados, { id: 2, status_atual: 'transbordo_humano' }];
    await vi.advanceTimersByTimeAsync(5000);
    expect(service.aguardando()).toBe(2);
    expect(service.eventos()).toBe(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(service.eventos()).toBe(1);
    falha = true;
    await vi.advanceTimersByTimeAsync(5000);
    expect(service.aguardando()).toBe(2);
    falha = false;
    dados = [dados[1]];
    await vi.advanceTimersByTimeAsync(5000);
    expect(service.aguardando()).toBe(1);
    dados = [...dados, { id: 1, status_atual: 'transbordo_humano' }];
    await vi.advanceTimersByTimeAsync(5000);
    expect(service.eventos()).toBe(2);
  });
});
