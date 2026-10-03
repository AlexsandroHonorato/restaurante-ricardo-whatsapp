<?php

namespace Tests\Feature;

use App\Models\Categoria;
use App\Models\Produto;
use App\Models\ProdutoVariacao;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CardapioDiasTest extends TestCase
{
    use RefreshDatabase;

    public function test_alterar_dias_preserva_preco_e_status_e_informa_bot(): void
    {
        $cat = Categoria::create(['nome' => 'Pratos', 'slug' => 'pratos', 'ativo' => true]);
        $p = Produto::create(['categoria_id' => $cat->id, 'nome' => 'Feijoada', 'tipo' => 'prato_do_dia', 'dias_disponiveis' => 'todos', 'ativo' => true]);
        $v = ProdutoVariacao::create(['produto_id' => $p->id, 'tamanho' => 'Grande', 'preco' => 30, 'ativo' => true]);
        $this->putJson('/api/cardapio/produtos/'.$p->id, ['dias_disponiveis' => 'quarta,sabado'])->assertOk()->assertJsonPath('produto.dias_disponiveis', 'quarta,sabado');
        $this->assertDatabaseHas('produto_variacoes', ['id' => $v->id, 'preco' => 30]);
        $this->assertTrue($p->fresh()->ativo);
        $this->assertStringContainsString('quarta,sabado', $this->getJson('/api/cardapio/texto')->assertOk()->json('cardapio_texto'));
        $this->putJson('/api/cardapio/produtos/'.$p->id, ['dias_disponiveis' => 'feriado'])->assertUnprocessable()->assertJsonValidationErrors('dias_disponiveis');
        $this->putJson('/api/cardapio/produtos/'.$p->id, ['dias_disponiveis' => ''])->assertUnprocessable();
    }
}
