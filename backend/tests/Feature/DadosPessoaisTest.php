<?php

namespace Tests\Feature;

use App\Models\Atendimento;
use App\Models\Cliente;
use App\Models\Endereco;
use App\Models\MensagemWhatsapp;
use App\Models\Pedido;
use App\Models\StatusConversa;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/** LGPD: exclusão a pedido do cliente e retenção automática, preservando o faturamento sem identificar ninguém. */
class DadosPessoaisTest extends TestCase
{
    use RefreshDatabase;

    private function clienteComDados(string $telefone, ?Carbon $ultimoContato = null): Cliente
    {
        $cliente = Cliente::create(['telefone' => $telefone, 'nome' => 'Maria Souza', 'ultimo_contato_em' => $ultimoContato ?? now()]);
        $endereco = Endereco::create(['cliente_id' => $cliente->id, 'logradouro' => 'Rua das Flores, 25', 'numero' => '25', 'bairro' => 'Centro', 'cep' => '11660-000', 'ponto_referencia' => 'Casa azul']);
        Pedido::create(['codigo_pedido' => 'PED-'.$telefone, 'cliente_id' => $cliente->id, 'endereco_id' => $endereco->id, 'status' => 'entregue',
            'forma_pagamento' => 'pix', 'valor_subtotal' => 30, 'valor_total' => 30, 'observacoes' => 'Interfone do apto 12, falar com Maria']);
        Atendimento::create(['cliente_id' => $cliente->id, 'status' => 'transbordo_humano', 'motivo_transbordo' => 'Maria quer trocar o endereço']);
        StatusConversa::create(['telefone' => $telefone, 'status_atual' => 'conversa_iniciada', 'rascunho' => ['endereco' => 'Rua das Flores']]);
        MensagemWhatsapp::create(['direcao' => 'entrada', 'telefone' => $telefone, 'wa_message_id' => 'w-'.$telefone, 'texto' => 'Sou a Maria', 'status' => 'processada']);

        return $cliente;
    }

    public function test_administrador_apaga_dados_do_cliente_e_mantem_valores_do_pedido(): void
    {
        $cliente = $this->clienteComDados('5512999990001');
        $this->deleteJson("/api/clientes/{$cliente->id}")->assertOk();

        $cliente->refresh();
        $this->assertSame('Cliente removido', $cliente->nome);
        $this->assertSame("removido-{$cliente->id}", $cliente->telefone);
        $endereco = Endereco::where('cliente_id', $cliente->id)->first();
        $this->assertSame('Removido a pedido do cliente', $endereco->logradouro);
        $this->assertNull($endereco->cep);
        $this->assertNull($endereco->ponto_referencia);
        $this->assertSame('Centro', $endereco->bairro);
        $pedido = Pedido::where('cliente_id', $cliente->id)->first();
        $this->assertNull($pedido->observacoes);
        $this->assertEquals(30, $pedido->valor_total);
        $this->assertNull(Atendimento::where('cliente_id', $cliente->id)->first()->motivo_transbordo);
        $this->assertSame(0, MensagemWhatsapp::where('telefone', '5512999990001')->count());
        $this->assertSame(0, StatusConversa::where('telefone', '5512999990001')->count());
    }

    public function test_operador_nao_apaga_dados_de_cliente(): void
    {
        $cliente = $this->clienteComDados('5512999990002');
        $this->actingAs(User::factory()->create(['role' => 'operador', 'active' => true]))
            ->deleteJson("/api/clientes/{$cliente->id}")->assertForbidden();
        $this->assertSame('Maria Souza', $cliente->fresh()->nome);
    }

    public function test_retencao_apaga_conversas_antigas_e_anonimiza_clientes_inativos(): void
    {
        Carbon::setTestNow('2026-10-05 03:30:00');
        $inativo = $this->clienteComDados('5512999990003', now()->subDays(731));
        $ativo = $this->clienteComDados('5512999990004', now()->subDays(10));
        MensagemWhatsapp::where('telefone', '5512999990004')->update(['created_at' => now()->subDays(181)]);
        MensagemWhatsapp::create(['direcao' => 'saida', 'telefone' => '5512999990004', 'chave' => 'recente', 'texto' => 'Oi', 'status' => 'enviada']);

        $this->artisan('botclient:aplicar-retencao')->assertSuccessful();

        $this->assertSame('Cliente removido', $inativo->fresh()->nome);
        $this->assertSame('Maria Souza', $ativo->fresh()->nome);
        $this->assertSame(['recente'], MensagemWhatsapp::where('telefone', '5512999990004')->pluck('chave')->all());
        // Rodar de novo não mexe em quem já foi anonimizado.
        $this->artisan('botclient:aplicar-retencao')->assertSuccessful();
        $this->assertSame("removido-{$inativo->id}", $inativo->fresh()->telefone);
        Carbon::setTestNow();
    }
}
