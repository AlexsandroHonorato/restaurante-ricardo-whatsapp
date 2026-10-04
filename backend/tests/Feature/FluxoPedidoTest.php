<?php

namespace Tests\Feature;

use App\Models\Atendimento;
use App\Models\HistoricoStatusPedido;
use App\Models\Pedido;
use App\Models\StatusConversa;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class FluxoPedidoTest extends TestCase
{
    use RefreshDatabase;

    public function test_transbordo_atualiza_status_conversacional_e_permanece_na_sincronizacao(): void
    {
        $dados = ['telefone' => '5512999991111', 'status' => 'conversa_iniciada', 'transbordo' => true, 'motivo_transbordo' => 'Cliente escolheu falar com a equipe'];
        $this->postJson('/api/status-conversa/sync', $dados)->assertOk()
            ->assertJsonPath('status_conversa.status_atual', 'transbordo_humano');
        $this->getJson('/api/status-conversa')->assertOk()->assertJsonPath('0.status_atual', 'transbordo_humano');
        $this->postJson('/api/status-conversa/sync', ['telefone' => $dados['telefone'], 'status' => 'transbordo_humano'])->assertOk()
            ->assertJsonPath('status_conversa.status_atual', 'transbordo_humano');
    }

    public function test_contato_envia_saudacao_uma_vez_e_rejeita_conversa_sem_transbordo(): void
    {
        Http::fake(['*' => Http::response(['ok' => true])]);
        $this->postJson('/api/status-conversa/sync', ['telefone' => '5512999997777', 'status' => 'transbordo_humano', 'transbordo' => true])->assertOk();
        $id = StatusConversa::where('telefone', '5512999997777')->firstOrFail()->id;
        $this->postJson("/api/status-conversa/{$id}/contato")->assertOk();
        $this->postJson("/api/status-conversa/{$id}/contato")->assertOk();
        $this->assertNotNull(StatusConversa::find($id)->contato_iniciado_em);
        $this->postJson('/api/status-conversa/sync', ['telefone' => '5512999997777', 'status' => 'transbordo_humano'])->assertOk();
        $this->assertNotNull(StatusConversa::find($id)->contato_iniciado_em);
        Http::assertSentCount(1);
        Http::assertSent(fn ($r) => str_contains($r['texto'], 'Como posso ajudar'));
        StatusConversa::find($id)->update(['status_atual' => 'conversa_iniciada']);
        $this->postJson("/api/status-conversa/{$id}/contato")->assertStatus(409);
    }

    private function dados(): array
    {
        return [
            'codigo_pedido' => 'PED-TESTE', 'telefone' => '5512999991111', 'nome' => 'Ana',
            'endereco' => 'Rua A, 10, Centro', 'formaPagamento' => 'Dinheiro',
            'total' => 'R$ 80,00', 'trocoPara' => '100,00',
            'itens' => ['2x Frango (Grande) - R$ 30,00', '1x Coca-Cola 2L - R$ 20,00'],
        ];
    }

    public function test_pedido_calcula_itens_e_troco_sem_inventar_taxa(): void
    {
        $this->postJson('/api/pedidos', $this->dados())->assertCreated()
            ->assertJsonPath('pedido.valor_total', '80.00')
            ->assertJsonPath('pedido.valor_subtotal', '80.00')
            ->assertJsonPath('pedido.taxa_entrega', '0.00')
            ->assertJsonPath('pedido.valor_troco', '20.00');
        $this->assertDatabaseHas('pedido_itens', ['nome_snapshot' => 'Frango', 'quantidade' => 2, 'subtotal' => 60]);
        $this->assertDatabaseHas('pedido_itens', ['nome_snapshot' => 'Coca-Cola 2L', 'subtotal' => 20]);
    }

    public function test_reenvio_do_pedido_nao_duplica_itens_cliente_ou_atendimento(): void
    {
        $this->postJson('/api/pedidos', $this->dados())->assertCreated();
        $this->postJson('/api/pedidos', $this->dados())->assertOk();
        $this->assertDatabaseCount('pedidos', 1);
        $this->assertDatabaseCount('pedido_itens', 2);
        $this->assertDatabaseCount('atendimentos', 1);
        $this->assertDatabaseHas('clientes', ['total_pedidos' => 1, 'total_gasto' => 80]);
    }

    public function test_total_inconsistente_e_troco_insuficiente_nao_gravam_dados(): void
    {
        $dados = $this->dados();
        $dados['total'] = '90,00';
        $this->postJson('/api/pedidos', $dados)->assertUnprocessable();
        $dados = $this->dados();
        $dados['trocoPara'] = '20,00';
        $this->postJson('/api/pedidos', $dados)->assertUnprocessable();
        $this->assertDatabaseCount('pedidos', 0);
        $this->assertDatabaseCount('clientes', 0);
    }

    public function test_despacho_repetido_nao_duplica_historico_e_nao_altera_rascunho(): void
    {
        Http::fake(['*' => Http::response(['ok' => true], 200)]);
        $this->postJson('/api/pedidos', $this->dados())->assertCreated();
        $id = Pedido::firstOrFail()->id;
        $this->postJson('/api/status-conversa/sync', ['telefone' => '5512999991111', 'status' => 'fazendo_pedido_pratos', 'rascunho' => ['pratos' => ['Novo pedido']]])->assertOk();
        $this->patchJson("/api/pedidos/{$id}/status", ['status' => 'saiu_para_entrega'])->assertOk()->assertJsonPath('notificacao_enviada', true);
        $this->patchJson("/api/pedidos/{$id}/status", ['status' => 'saiu_para_entrega'])->assertOk()->assertJsonPath('status_alterado', false);
        $this->assertSame(2, HistoricoStatusPedido::count());
        $this->assertDatabaseHas('status_conversas', ['status_atual' => 'fazendo_pedido_pratos']);
    }

    public function test_falha_na_notificacao_nao_e_informada_como_envio_confirmado(): void
    {
        Http::fake(['*' => Http::sequence()->push(['ok' => false], 502)->push(['ok' => true], 200)]);
        $this->postJson('/api/pedidos', $this->dados())->assertCreated();
        $id = Pedido::firstOrFail()->id;
        $this->patchJson("/api/pedidos/{$id}/status", ['status' => 'saiu_para_entrega'])->assertOk()
            ->assertJsonPath('notificacao_enviada', false)->assertJsonPath('notificacao_whatsapp', null);
        $this->assertDatabaseHas('pedidos', ['status' => 'saiu_para_entrega']);
        $this->patchJson("/api/pedidos/{$id}/status", ['status' => 'saiu_para_entrega'])->assertOk()->assertJsonPath('notificacao_enviada', true);
    }

    public function test_status_terminal_nao_regride_e_status_igual_nao_cria_historico(): void
    {
        $this->postJson('/api/pedidos', $this->dados())->assertCreated();
        $id = Pedido::firstOrFail()->id;
        $this->patchJson("/api/pedidos/{$id}/status", ['status' => 'em_preparo'])->assertOk();
        $this->assertSame(1, HistoricoStatusPedido::count());
        $this->patchJson("/api/pedidos/{$id}/status", ['status' => 'cancelado'])->assertOk();
        $this->patchJson("/api/pedidos/{$id}/status", ['status' => 'em_preparo'])->assertUnprocessable();
    }

    public function test_sync_aceita_nome_nulo_sem_fabricar_contagem_de_mensagens(): void
    {
        $dados = ['telefone' => '5512999991111', 'nome' => null, 'status' => 'coletando_endereco', 'rascunho' => []];
        $this->postJson('/api/status-conversa/sync', $dados)->assertOk();
        $this->postJson('/api/status-conversa/sync', $dados)->assertOk();
        $this->assertDatabaseHas('clientes', ['nome' => 'Cliente WhatsApp']);
        $this->assertSame(1, Atendimento::count());
        $this->assertSame(0, Atendimento::firstOrFail()->total_mensagens_cliente);
    }

    public function test_consulta_por_codigo_exige_telefone_do_dono_do_pedido(): void
    {
        $this->postJson('/api/pedidos', $this->dados())->assertCreated();
        $this->getJson('/api/pedidos/consulta/bot?telefone=5512999991111&codigo_pedido=PED-TESTE')->assertOk()->assertJsonPath('pedido.codigo_pedido', 'PED-TESTE');
        $this->getJson('/api/pedidos/consulta/bot?telefone=5512999992222&codigo_pedido=PED-TESTE')->assertNotFound();
    }

    public function test_sincronizacoes_intermediarias_nao_contam_como_mensagens(): void
    {
        $dados = ['telefone' => '5512999991111', 'status' => 'fazendo_pedido_pratos', 'rascunho' => []];
        $this->postJson('/api/status-conversa/sync', $dados)->assertOk();
        $this->postJson('/api/status-conversa/sync', $dados)->assertOk();
        $this->postJson('/api/status-conversa/sync', [...$dados, 'registrar_mensagem' => true])->assertOk();
        $this->assertSame(1, Atendimento::firstOrFail()->total_mensagens_cliente);
        $this->assertSame(1, Atendimento::firstOrFail()->total_mensagens_bot);
    }

    public function test_pedido_minimo_aplica_se_a_entrega_e_preserva_retirada(): void
    {
        $dados = $this->dados();
        $dados['itens'] = ['1x Bebida - R$ 20,00'];
        $dados['total'] = '20,00';
        $this->postJson('/api/pedidos', $dados)->assertUnprocessable();
        $dados['endereco'] = 'Retirada no balcão';
        $this->postJson('/api/pedidos', $dados)->assertCreated();
    }
}
