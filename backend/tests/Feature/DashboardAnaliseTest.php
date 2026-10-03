<?php

namespace Tests\Feature;

use App\Models\Cliente;
use App\Models\Pedido;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardAnaliseTest extends TestCase
{
    use RefreshDatabase;

    public function test_periodo_filtra_pagamentos_e_bairros(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-02 15:00:00', 'UTC'));
        try {
            $cliente = Cliente::create(['telefone' => '5512999994321', 'nome' => 'Teste']);
            foreach ([['RECENTE', '2026-10-01 15:00:00', 40], ['ANTIGO', '2026-09-12 15:00:00', 60]] as [$codigo, $data, $valor]) {
                $pedido = Pedido::create(['codigo_pedido' => $codigo, 'cliente_id' => $cliente->id, 'forma_pagamento' => 'pix', 'status' => 'entregue', 'valor_total' => $valor]);
                $pedido->created_at = $data;
                $pedido->save();
            }
            $this->getJson('/api/dashboard/formas-pagamento?dias=7')->assertOk()->assertJsonPath('0.quantidade', 1)->assertJsonPath('0.faturamento', 40);
            $this->getJson('/api/dashboard/formas-pagamento?dias=30')->assertOk()->assertJsonPath('0.quantidade', 2)->assertJsonPath('0.faturamento', 100);
            $this->getJson('/api/dashboard/mapa-bairros?dias=7')->assertOk()->assertJsonPath('0.total_pedidos', 1);
            $this->getJson('/api/dashboard/mapa-bairros?dias=30')->assertOk()->assertJsonPath('0.total_pedidos', 2);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_ausencia_de_medicoes_e_janela_completa(): void
    {
        $this->getJson('/api/dashboard/analises?dias=7')->assertOk()->assertJsonCount(7, 'vendas')->assertJsonCount(7, 'demanda')->assertJsonPath('tempos.0.minutos', null)->assertJsonPath('atendimentos.conversao', null);
    }

    public function test_ticket_exclui_cancelados_e_usa_dia_local(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-03 01:00:00', 'UTC'));
        try {
            $c = Cliente::create(['telefone' => '5512999991234', 'nome' => 'Teste']);
            foreach ([['A', 'entregue', 40], ['B', 'cancelado', 80], ['C', 'em_preparo', 60]] as [$codigo,$status,$valor]) {
                $p = Pedido::create(['codigo_pedido' => $codigo, 'cliente_id' => $c->id, 'forma_pagamento' => 'pix', 'status' => $status, 'valor_total' => $valor, 'motivo_cancelamento' => $status === 'cancelado' ? 'Desistencia' : null]);
                $p->created_at = '2026-10-03 01:00:00';
                if ($status === 'entregue') {
                    $p->preparado_em = '2026-10-03 01:05:00';
                    $p->saiu_entrega_em = '2026-10-03 01:25:00';
                    $p->entregue_em = '2026-10-03 01:40:00';
                }
                $p->save();
            }
            $this->getJson('/api/dashboard/analises?dias=1')->assertOk()->assertJsonPath('vendas.0.data', '2026-10-02')->assertJsonPath('vendas.0.faturamento', 100)->assertJsonPath('vendas.0.ticket_medio', 50)->assertJsonPath('vendas.0.total_pedidos', 3)->assertJsonPath('tempos.0.minutos', 20)->assertJsonPath('tempos.1.minutos', 15)->assertJsonPath('tempos.0.amostras', 1)->assertJsonPath('cancelamentos.0.nome', 'Desistencia');
            $this->getJson('/api/dashboard/vendas-grafico?dias=1')->assertOk()->assertJsonPath('0.ticket_medio', 50);
        } finally {
            Carbon::setTestNow();
        }
    }
}
