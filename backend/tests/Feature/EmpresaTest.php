<?php

namespace Tests\Feature;

use App\Models\StatusConversa;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** Dados da empresa editáveis no painel e usados pelo bot (nome, contatos, endereço, pagamento, regras). */
class EmpresaTest extends TestCase
{
    use RefreshDatabase;

    private function dados(): array
    {
        return [
            'nome' => 'Pizzaria Bella', 'telefone' => '(12) 3333-4444', 'telefone_2' => null,
            'endereco' => 'Rua Central, 100 - Centro', 'quem_somos' => 'Pizzas artesanais desde 2010.',
            'formas_pagamento' => "- Pix\n- Dinheiro", 'politicas' => '- Pedido mínimo: R$ 30,00.',
        ];
    }

    public function test_administrador_edita_e_painel_le_os_dados(): void
    {
        $this->putJson('/api/empresa', $this->dados())->assertOk();
        $this->getJson('/api/empresa')->assertOk()->assertJsonPath('nome', 'Pizzaria Bella')->assertJsonPath('endereco', 'Rua Central, 100 - Centro');
    }

    public function test_validacao_e_permissao(): void
    {
        $this->putJson('/api/empresa', [...$this->dados(), 'nome' => ''])->assertUnprocessable();
        $this->putJson('/api/empresa', [...$this->dados(), 'telefone' => 'liga pra mim'])->assertUnprocessable();
        $this->actingAs(User::factory()->create(['role' => 'operador', 'active' => true]))
            ->putJson('/api/empresa', $this->dados())->assertForbidden();
    }

    public function test_bot_recebe_ficha_com_horarios_da_agenda_e_so_secoes_preenchidas(): void
    {
        $this->putJson('/api/empresa', [...$this->dados(), 'politicas' => null])->assertOk();
        $resposta = $this->getJson('/api/bot/empresa')->assertOk()
            ->assertJsonPath('nome', 'Pizzaria Bella')->assertJsonPath('telefone', '(12) 3333-4444');
        $texto = $resposta->json('texto');
        $this->assertStringContainsString("## Quem somos\nPizzas artesanais desde 2010.", $texto);
        $this->assertStringContainsString('## Horários de Atendimento', $texto);
        $this->assertStringContainsString('segunda-feira: 11:00 às 14:30', $texto);
        $this->assertStringContainsString('domingo: fechado', $texto);
        $this->assertStringContainsString("## Formas de Pagamento\n- Pix\n- Dinheiro", $texto);
        $this->assertStringNotContainsString('Políticas', $texto);
    }

    public function test_tipo_de_negocio_e_validado_e_enviado_ao_bot(): void
    {
        $this->putJson('/api/empresa', [...$this->dados(), 'tipo_negocio' => 'oficina'])->assertUnprocessable();
        $this->putJson('/api/empresa', [...$this->dados(), 'tipo_negocio' => 'loja'])->assertOk();
        $this->getJson('/api/bot/empresa')->assertJsonPath('tipo_negocio', 'loja');
        $this->putJson('/api/empresa', $this->dados())->assertOk();
        $this->getJson('/api/empresa')->assertJsonPath('tipo_negocio', 'loja');
    }

    public function test_ficha_vazia_devolve_texto_vazio_para_o_bot_usar_o_arquivo_padrao(): void
    {
        $this->getJson('/api/bot/empresa')->assertOk()->assertJsonPath('texto', '')->assertJsonPath('nome', null);
    }

    public function test_saudacao_do_atendimento_humano_usa_nome_cadastrado(): void
    {
        $this->putJson('/api/empresa', $this->dados())->assertOk();
        Http::fake(['*' => Http::response(['ok' => true])]);
        $this->postJson('/api/status-conversa/sync', ['telefone' => '5512999990001', 'status' => 'transbordo_humano', 'transbordo' => true]);
        $id = StatusConversa::firstOrFail()->id;
        $this->postJson("/api/status-conversa/{$id}/contato")->assertOk();
        Http::assertSent(fn ($r) => ($r['texto'] ?? null) === 'Olá! Sou da equipe do Pizzaria Bella. Como posso ajudar você?');
    }
}
