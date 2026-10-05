<?php

namespace Tests\Feature;

use App\Models\Cliente;
use App\Models\Pedido;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class ImpressoraTest extends TestCase
{
    use RefreshDatabase;

    protected bool $authenticate = false;

    private string $token;

    protected function setUp(): void
    {
        parent::setUp();
        $this->token = str_repeat('i', 48);
        config(['services.impressora.token' => $this->token]);
    }

    private function pedido(string $codigo, array $extra = []): Pedido
    {
        $cliente = Cliente::firstOrCreate(['telefone' => '5512999990001'], ['nome' => 'Ana']);

        $pedido = Pedido::create([
            'codigo_pedido' => $codigo, 'cliente_id' => $cliente->id, 'status' => 'em_preparo', 'forma_pagamento' => 'pix',
            'valor_subtotal' => 30, 'taxa_entrega' => 0, 'valor_total' => 30, ...$extra,
        ]);
        if (isset($extra['created_at'])) {
            $pedido->forceFill(['created_at' => $extra['created_at']])->save();
        }

        return $pedido;
    }

    private function comToken(?string $token = null): static
    {
        return $this->withHeaders(['Authorization' => 'Bearer '.($token ?? $this->token)]);
    }

    public function test_sem_token_ou_com_token_do_bot_nao_acessa(): void
    {
        $this->withHeaders(['Authorization' => 'Bearer errado'])->getJson('/api/impressora/pendentes')->assertUnauthorized();
        $this->comToken(str_repeat('t', 64))->getJson('/api/impressora/pendentes')->assertUnauthorized();
        config(['services.impressora.token' => null]);
        $this->comToken()->getJson('/api/impressora/pendentes')->assertUnauthorized();
        $this->comToken()->getJson('/api/pedidos')->assertUnauthorized(); // o token não abre o painel
    }

    public function test_lista_so_pedidos_novos_sem_comanda_do_mais_antigo_ao_mais_novo(): void
    {
        Carbon::setTestNow('2026-10-05 12:00:00');
        $this->pedido('PED-ANTIGO', ['created_at' => now()->subHours(13)]);
        $this->pedido('PED-ENTREGUE', ['status' => 'entregue']);
        $this->pedido('PED-IMPRESSO', ['comanda_impressa_em' => now()]);
        $this->pedido('PED-2', ['created_at' => now()->subMinutes(5)]);
        $this->pedido('PED-1', ['created_at' => now()->subMinutes(10)]);

        $this->comToken()->getJson('/api/impressora/pendentes')->assertOk()
            ->assertJsonCount(2, 'pedidos')
            ->assertJsonPath('pedidos.0.codigo_pedido', 'PED-1')
            ->assertJsonPath('pedidos.1.codigo_pedido', 'PED-2')
            ->assertJsonPath('pedidos.0.cliente.nome', 'Ana');
        Carbon::setTestNow();
    }

    public function test_pega_uma_vez_e_devolve_quando_a_impressora_falha(): void
    {
        $p = $this->pedido('PED-1');
        $this->comToken()->postJson("/api/impressora/pedidos/{$p->id}/comanda")->assertOk()->assertJsonPath('primeira', true);
        $this->comToken()->postJson("/api/impressora/pedidos/{$p->id}/comanda")->assertOk()->assertJsonPath('primeira', false);
        $this->comToken()->getJson('/api/impressora/pendentes')->assertJsonCount(0, 'pedidos');

        $this->comToken()->deleteJson("/api/impressora/pedidos/{$p->id}/comanda")->assertOk();
        $this->comToken()->getJson('/api/impressora/pendentes')->assertJsonCount(1, 'pedidos');
        $this->comToken()->postJson('/api/impressora/pedidos/999999/comanda')->assertNotFound();
    }
}
