<?php

namespace Tests\Feature;

use App\Models\Cliente;
use App\Models\Pedido;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardKpisTest extends TestCase
{
    use RefreshDatabase;

    public function test_kpis_contam_pedidos_e_faturamento_no_dia_de_sao_paulo(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-03 01:00:00', 'UTC'));
        try {
            $cliente = Cliente::create(['telefone' => '5512999991111', 'nome' => 'Ana']);
            foreach (['2026-10-02 02:59:59', '2026-10-02 03:00:00', '2026-10-03 02:59:59', '2026-10-03 03:00:00'] as $indice => $data) {
                $pedido = Pedido::create([
                    'codigo_pedido' => 'PED-KPI-'.$indice, 'cliente_id' => $cliente->id,
                    'status' => 'em_preparo', 'forma_pagamento' => 'pix', 'valor_total' => 30,
                ]);
                $pedido->created_at = Carbon::parse($data, 'UTC');
                $pedido->save();
            }
            $this->getJson('/api/dashboard/kpis')->assertOk()
                ->assertJsonPath('total_pedidos', 4)
                ->assertJsonPath('pedidos_hoje', 2)
                ->assertJsonPath('faturamento_hoje', 60)
                ->assertJsonPath('faturamento_total', 120);
        } finally {
            Carbon::setTestNow();
        }
    }
}
