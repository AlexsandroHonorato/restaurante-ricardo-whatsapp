<?php

namespace Tests\Feature;

use App\Models\Atendimento;
use App\Models\Categoria;
use App\Models\HistoricoStatusPedido;
use App\Models\Pedido;
use App\Models\Produto;
use App\Models\ProdutoVariacao;
use App\Models\StatusConversa;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
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

    public function test_monitor_de_conversas_traz_so_ultimas_24h_e_transbordos_pendentes(): void
    {
        $antiga = now()->subDays(3);
        StatusConversa::create(['telefone' => '5512000000001', 'status_atual' => 'conversa_iniciada', 'ultimo_contato_em' => $antiga]);
        StatusConversa::create(['telefone' => '5512000000002', 'status_atual' => 'transbordo_humano', 'ultimo_contato_em' => $antiga]);
        StatusConversa::create(['telefone' => '5512000000003', 'status_atual' => 'transbordo_humano', 'ultimo_contato_em' => $antiga, 'contato_iniciado_em' => $antiga]);
        for ($i = 0; $i < 205; $i++) {
            StatusConversa::create(['telefone' => '55129'.str_pad((string) $i, 8, '0', STR_PAD_LEFT), 'status_atual' => 'coletando_endereco', 'ultimo_contato_em' => now()->subMinutes($i)]);
        }

        $lista = $this->getJson('/api/status-conversa')->assertOk()->json();

        $this->assertCount(200, $lista);
        $this->assertSame('5512000000002', $lista[0]['telefone'], 'transbordo sem contato vem primeiro, mesmo antigo');
        $this->assertSame('551290000000'.'0', $lista[1]['telefone'], 'depois as mais recentes');
        $this->assertNotContains('5512000000001', array_column($lista, 'telefone'));
        $this->assertNotContains('5512000000003', array_column($lista, 'telefone'));
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

    private ProdutoVariacao $frango;

    private ProdutoVariacao $coca;

    protected function setUp(): void
    {
        parent::setUp();
        $categoria = Categoria::create(['nome' => 'Pratos', 'slug' => 'pratos', 'ordem_exibicao' => 1, 'ativo' => true]);
        $frango = Produto::create(['categoria_id' => $categoria->id, 'tipo' => 'prato_executivo', 'nome' => 'Frango', 'dias_disponiveis' => 'todos', 'ativo' => true]);
        $this->frango = $frango->variacoes()->create(['tamanho' => 'Grande', 'preco' => 30, 'ativo' => true]);
        $coca = Produto::create(['categoria_id' => $categoria->id, 'tipo' => 'bebida', 'nome' => 'Coca-Cola 2L', 'dias_disponiveis' => 'todos', 'ativo' => true]);
        $this->coca = $coca->variacoes()->create(['tamanho' => 'Padrão', 'preco' => 20, 'ativo' => true]);
    }

    private function dados(): array
    {
        return [
            'codigo_pedido' => 'PED-TESTE', 'telefone' => '5512999991111', 'nome' => 'Ana',
            'endereco' => 'Rua A, 10, Centro', 'formaPagamento' => 'Dinheiro', 'trocoPara' => '100,00',
            'itens' => [
                ['variacao_id' => $this->frango->id, 'quantidade' => 2],
                ['variacao_id' => $this->coca->id, 'quantidade' => 1],
            ],
        ];
    }

    public function test_pedido_calcula_itens_e_troco_sem_inventar_taxa(): void
    {
        $this->postJson('/api/pedidos', $this->dados())->assertCreated()
            ->assertJsonPath('pedido.valor_total', '80.00')
            ->assertJsonPath('pedido.valor_subtotal', '80.00')
            ->assertJsonPath('pedido.taxa_entrega', '0.00')
            ->assertJsonPath('pedido.valor_troco', '20.00');
        $this->assertDatabaseHas('pedido_itens', [
            'nome_snapshot' => 'Frango', 'tamanho_snapshot' => 'Grande', 'quantidade' => 2, 'subtotal' => 60,
            'produto_id' => $this->frango->produto_id, 'variacao_id' => $this->frango->id,
        ]);
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

    public function test_preco_e_total_enviados_sao_ignorados_e_troco_insuficiente_nao_grava(): void
    {
        $dados = $this->dados();
        $dados['total'] = '1,00';
        $dados['itens'][0]['preco'] = 0.01;
        $this->postJson('/api/pedidos', $dados)->assertCreated()->assertJsonPath('pedido.valor_total', '80.00');
        Pedido::query()->delete();
        $dados = $this->dados();
        $dados['codigo_pedido'] = 'PED-TROCO';
        $dados['trocoPara'] = '20,00';
        $this->postJson('/api/pedidos', $dados)->assertUnprocessable();
        $this->assertDatabaseMissing('pedidos', ['codigo_pedido' => 'PED-TROCO']);
    }

    public function test_item_pausado_inexistente_ou_fora_do_dia_e_recusado_com_motivo(): void
    {
        $this->frango->update(['ativo' => false]);
        $this->postJson('/api/pedidos', $this->dados())->assertUnprocessable()
            ->assertJsonPath('errors.itens.0', 'Frango (Grande) não está disponível no momento.');

        $this->frango->update(['ativo' => true]);
        $this->frango->produto->update(['ativo' => false]);
        $this->postJson('/api/pedidos', $this->dados())->assertUnprocessable();

        $this->frango->produto->update(['ativo' => true, 'dias_disponiveis' => 'qua,sab']);
        Carbon::setTestNow(Carbon::parse('2026-10-05 12:00', 'America/Sao_Paulo')); // segunda-feira
        $this->postJson('/api/pedidos', $this->dados())->assertUnprocessable()
            ->assertJsonPath('errors.itens.0', 'Frango só é servido em: quarta, sábado.');
        Carbon::setTestNow(Carbon::parse('2026-10-07 12:00', 'America/Sao_Paulo')); // quarta-feira
        $this->postJson('/api/pedidos', $this->dados())->assertCreated();
        Carbon::setTestNow();

        $dados = $this->dados();
        $dados['codigo_pedido'] = 'PED-OUTRO';
        $dados['itens'] = [['variacao_id' => 999999, 'quantidade' => 1]];
        $this->postJson('/api/pedidos', $dados)->assertUnprocessable();
        $this->assertDatabaseCount('pedidos', 1);
    }

    public function test_texto_do_cardapio_traz_codigo_de_cada_tamanho_para_a_ia(): void
    {
        $this->getJson('/api/cardapio/texto')->assertOk()
            ->assertSee("Grande: R$ 30,00 [cod {$this->frango->id}]", false);
    }

    public function test_editar_prato_preserva_codigo_dos_tamanhos_mantidos(): void
    {
        $id = $this->frango->produto_id;
        $this->putJson("/api/cardapio/produtos/{$id}", ['variacoes' => [
            ['tamanho' => 'grande ', 'preco' => 32],
            ['tamanho' => 'Infantil', 'preco' => 25],
        ]])->assertOk();
        $this->assertDatabaseHas('produto_variacoes', ['id' => $this->frango->id, 'preco' => 32]);
        $this->assertDatabaseHas('produto_variacoes', ['produto_id' => $id, 'tamanho' => 'Infantil']);
        $this->assertSame(2, ProdutoVariacao::where('produto_id', $id)->count());
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

    public function test_comanda_impressa_uma_vez_e_sai_da_lista_de_pendentes(): void
    {
        $this->postJson('/api/pedidos', $this->dados())->assertCreated();
        $id = Pedido::firstOrFail()->id;
        $this->getJson('/api/pedidos?sem_comanda=1')->assertOk()->assertJsonPath('data.0.id', $id);
        $this->postJson("/api/pedidos/{$id}/comanda")->assertOk()->assertJsonPath('primeira', true);
        $this->postJson("/api/pedidos/{$id}/comanda")->assertOk()->assertJsonPath('primeira', false);
        $this->getJson('/api/pedidos?sem_comanda=1')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/pedidos')->assertOk()->assertJsonCount(1, 'data');
        $this->postJson('/api/pedidos/999/comanda')->assertNotFound();
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

    public function test_notificacao_na_fila_do_bot_e_informada_como_reenvio_automatico(): void
    {
        Http::fake(['*' => Http::response(['ok' => false, 'pendente' => true], 200)]);
        $this->postJson('/api/pedidos', $this->dados())->assertCreated();
        $id = Pedido::firstOrFail()->id;
        $this->patchJson("/api/pedidos/{$id}/status", ['status' => 'saiu_para_entrega'])->assertOk()
            ->assertJsonPath('notificacao_enviada', false)
            ->assertJsonPath('erro_notificacao', 'Notificação na fila: o WhatsApp não respondeu e ela será reenviada automaticamente.');
    }

    public function test_historico_registra_usuario_autenticado_e_ignora_autor_enviado(): void
    {
        Http::fake(['*' => Http::response(['ok' => true])]);
        $this->postJson('/api/pedidos', $this->dados())->assertCreated();
        $id = Pedido::firstOrFail()->id;
        $this->patchJson("/api/pedidos/{$id}/status", ['status' => 'saiu_para_entrega', 'alterado_por' => 'outra pessoa'])->assertOk();
        $this->assertSame(auth()->user()->email, HistoricoStatusPedido::latest('id')->firstOrFail()->alterado_por);
    }

    public function test_saudacao_do_transbordo_usa_nome_da_empresa_configurado(): void
    {
        config(['services.empresa.nome' => 'Pizzaria Exemplo']);
        Http::fake(['*' => Http::response(['ok' => true])]);
        $this->postJson('/api/status-conversa/sync', ['telefone' => '5512999996666', 'status' => 'transbordo_humano', 'transbordo' => true])->assertOk();
        $id = StatusConversa::where('telefone', '5512999996666')->firstOrFail()->id;
        $this->postJson("/api/status-conversa/{$id}/contato")->assertOk();
        Http::assertSent(fn ($r) => $r['texto'] === 'Olá! Sou da equipe do Pizzaria Exemplo. Como posso ajudar você?');
    }

    public function test_pedido_minimo_aplica_se_a_entrega_e_preserva_retirada(): void
    {
        $dados = $this->dados();
        $dados['itens'] = [['variacao_id' => $this->coca->id, 'quantidade' => 1]];
        $dados['trocoPara'] = null;
        $this->postJson('/api/pedidos', $dados)->assertUnprocessable();
        $dados['endereco'] = 'Retirada no balcão';
        $this->postJson('/api/pedidos', $dados)->assertCreated();
    }
}
