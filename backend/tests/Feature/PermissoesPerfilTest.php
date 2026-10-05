<?php

namespace Tests\Feature;

use App\Models\Categoria;
use App\Models\Produto;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Operador cuida de pedidos, atendimentos e clientes; Configurações (dashboard, cardápio, horários) são do administrador. */
class PermissoesPerfilTest extends TestCase
{
    use RefreshDatabase;

    private Produto $produto;

    protected function setUp(): void
    {
        parent::setUp();
        $categoria = Categoria::create(['nome' => 'Pratos', 'slug' => 'pratos', 'ativo' => true]);
        $this->produto = Produto::create(['categoria_id' => $categoria->id, 'tipo' => 'prato_executivo', 'nome' => 'Frango', 'ativo' => true]);
        $this->produto->variacoes()->create(['tamanho' => 'Grande', 'preco' => 30, 'ativo' => true]);
    }

    private function comoOperador(): static
    {
        return $this->actingAs(User::factory()->create(['role' => 'operador', 'active' => true]));
    }

    public function test_operador_nao_altera_cardapio_precos_nem_horarios(): void
    {
        $this->comoOperador();
        $id = $this->produto->id;
        $novo = ['categoria_id' => $this->produto->categoria_id, 'nome' => 'Bife', 'variacoes' => [['tamanho' => 'Grande', 'preco' => 35]]];
        $this->postJson('/api/cardapio/produtos', $novo)->assertForbidden();
        $this->putJson("/api/cardapio/produtos/{$id}", ['variacoes' => [['tamanho' => 'Grande', 'preco' => 1]]])->assertForbidden();
        $this->deleteJson("/api/cardapio/produtos/{$id}")->assertForbidden();
        $this->putJson('/api/horarios-atendimento/1', ['ativo' => false])->assertForbidden();
        $this->assertDatabaseHas('produto_variacoes', ['produto_id' => $id, 'preco' => 30]);
    }

    public function test_operador_nao_pausa_prato_nem_ve_graficos_mas_ve_contadores(): void
    {
        $this->comoOperador();
        $this->patchJson("/api/cardapio/produtos/{$this->produto->id}/toggle")->assertForbidden();
        $this->assertTrue($this->produto->fresh()->ativo);
        $this->getJson('/api/dashboard/analises')->assertForbidden();
        $this->getJson('/api/dashboard/vendas-grafico')->assertForbidden();
        $this->getJson('/api/dashboard/kpis')->assertOk();
    }

    public function test_administrador_mantem_acesso_completo(): void
    {
        $this->putJson("/api/cardapio/produtos/{$this->produto->id}", ['variacoes' => [['tamanho' => 'Grande', 'preco' => 32]]])->assertOk();
        $this->putJson('/api/horarios-atendimento/7', ['ativo' => false])->assertOk();
        $this->patchJson("/api/cardapio/produtos/{$this->produto->id}/toggle")->assertOk()->assertJsonPath('ativo', false);
        $this->getJson('/api/dashboard/vendas-grafico')->assertOk();
    }
}
