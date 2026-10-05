import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComandaService, formatarComanda } from './comanda.service';
import { API_BASE } from './session-state';
import { Pedido } from '../models/dashboard.model';

const pedido = (id: number, codigo: string): Pedido =>
  ({
    id,
    codigo_pedido: codigo,
    status: 'em_preparo',
    forma_pagamento: 'cartao_credito',
    valor_subtotal: '70.00',
    taxa_entrega: '10.00',
    valor_desconto: '0.00',
    valor_total: '80.00',
    troco_para: null,
    observacoes: 'Sem cebola <b>',
    created_at: '2026-10-04T15:30:00Z',
    cliente: { nome: 'Maria', telefone: '5512999991111' },
    endereco: { logradouro: 'Rua A', numero: '10', bairro: 'Centro', ponto_referencia: 'Padaria' },
    itens: [
      {
        id: 1,
        quantidade: 2,
        nome_snapshot: 'Feijoada completa da casa',
        tamanho_snapshot: 'Grande',
        subtotal: '70.00',
        observacao: 'bem quente',
        adicionais: [{ quantidade: 1, nome_snapshot: 'Farofa' }],
      },
    ],
  }) as unknown as Pedido;

describe('Comanda da cozinha', () => {
  it('formata a comanda em 32 colunas com itens, endereço, valores e observações', () => {
    const texto = formatarComanda(pedido(1, 'PED-261004-001'));
    expect(texto).toContain('COMANDA PED-261004-001');
    expect(texto).toContain('04/10/2026, 12:30');
    expect(texto).toContain('Entrega: Rua A, 10 - Centro');
    expect(texto).toContain('Ref.: Padaria');
    expect(texto).toContain('2x Feijoada completa da casa (Grande)');
    expect(texto).toContain('   + 1x Farofa');
    expect(texto).toContain('   obs: bem quente');
    expect(texto).toContain('Pagamento: CARTAO CREDITO');
    expect(texto).toContain('OBS: Sem cebola <b>');
    expect(texto).not.toContain('Desconto');
    for (const l of texto.split('\n')) {
      if (/R\$/.test(l)) expect(l.length).toBeLessThanOrEqual(32);
    }
    expect(texto.split('\n').find((l) => l.startsWith('TOTAL'))).toMatch(/^TOTAL\s+R\$\s80,00$/);
  });

  function montar() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const servico = TestBed.inject(ComandaService);
    const impressos: string[] = [];
    vi.spyOn(servico as any, 'enviarParaImpressora').mockImplementation((t: unknown) =>
      impressos.push(t as string),
    );
    return { servico, http: TestBed.inject(HttpTestingController), impressos };
  }

  it('impressão automática imprime do mais antigo ao mais novo só o que este aparelho marcou primeiro', () => {
    const { servico, http, impressos } = montar();
    servico.imprimirPendentes();
    servico.imprimirPendentes(); // busca em andamento: não duplica
    http
      .expectOne(`${API_BASE}/pedidos?sem_comanda=1&per_page=20`)
      .flush({ data: [pedido(2, 'PED-2'), pedido(1, 'PED-1')] });
    http.expectOne(`${API_BASE}/pedidos/1/comanda`).flush({ primeira: true });
    http.expectOne(`${API_BASE}/pedidos/2/comanda`).flush({ primeira: false });
    expect(impressos).toHaveLength(1);
    expect(impressos[0]).toContain('PED-1');
    servico.imprimirPendentes();
    http.expectOne(`${API_BASE}/pedidos?sem_comanda=1&per_page=20`).flush({ data: [] });
    http.verify();
  });

  it('impressão manual sempre imprime (reimpressão) e registra no servidor', () => {
    const { servico, http, impressos } = montar();
    servico.imprimir(pedido(3, 'PED-3'));
    http
      .expectOne({ method: 'POST', url: `${API_BASE}/pedidos/3/comanda` })
      .flush({ primeira: false });
    expect(impressos).toHaveLength(1);
    http.verify();
  });
});
