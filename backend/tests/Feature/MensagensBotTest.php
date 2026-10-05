<?php

namespace Tests\Feature;

use App\Models\Categoria;
use App\Models\MensagemWhatsapp;
use App\Models\Pedido;
use App\Models\Produto;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class MensagensBotTest extends TestCase
{
    use RefreshDatabase;

    private const TEL = '5512999990001';

    private function entrada(string $id = 'wamid.1', string $texto = 'oi'): array
    {
        return ['wa_message_id' => $id, 'telefone' => self::TEL, 'tipo' => 'text', 'texto' => $texto];
    }

    public function test_entrada_e_gravada_uma_unica_vez_pelo_id_da_meta(): void
    {
        $this->postJson('/api/bot/mensagens/entrada', $this->entrada())->assertCreated()->assertJsonPath('duplicada', false);
        $this->postJson('/api/bot/mensagens/entrada', $this->entrada())->assertOk()->assertJsonPath('duplicada', true);
        $this->assertSame(1, MensagemWhatsapp::count());
        $this->assertDatabaseHas('mensagens_whatsapp', ['direcao' => 'entrada', 'status' => 'pendente', 'texto' => 'oi']);
    }

    public function test_saida_e_idempotente_pela_chave(): void
    {
        $dados = ['telefone' => self::TEL, 'texto' => 'Olá!', 'chave' => 'resp:wamid.1'];
        $id = $this->postJson('/api/bot/mensagens/saida', $dados)->assertCreated()->json('mensagem.id');
        $this->postJson('/api/bot/mensagens/saida', [...$dados, 'texto' => 'outro'])->assertOk()->assertJsonPath('mensagem.id', $id)
            ->assertJsonPath('mensagem.texto', 'Olá!');
    }

    public function test_falha_de_envio_reagenda_com_intervalo_crescente_e_desiste_apos_6_tentativas(): void
    {
        Carbon::setTestNow('2026-10-05 12:00:00');
        $id = $this->postJson('/api/bot/mensagens/saida', ['telefone' => self::TEL, 'texto' => 'x', 'chave' => 'k'])->json('mensagem.id');
        $this->patchJson("/api/bot/mensagens/{$id}", ['status' => 'pendente', 'erro' => 'HTTP 503'])->assertOk();
        $primeira = MensagemWhatsapp::find($id);
        $this->assertSame(1, $primeira->tentativas);
        $this->assertEquals(now()->addSeconds(30), $primeira->proxima_tentativa_em);
        $this->patchJson("/api/bot/mensagens/{$id}", ['status' => 'pendente', 'erro' => 'HTTP 503'])->assertOk();
        $this->assertEquals(now()->addMinutes(2), MensagemWhatsapp::find($id)->proxima_tentativa_em);
        foreach (range(3, 6) as $_) {
            $this->patchJson("/api/bot/mensagens/{$id}", ['status' => 'pendente', 'erro' => 'HTTP 503'])->assertOk();
        }
        $this->assertSame('falhou', MensagemWhatsapp::find($id)->status);
        Carbon::setTestNow();
    }

    public function test_envio_confirmado_guarda_id_da_meta(): void
    {
        $id = $this->postJson('/api/bot/mensagens/saida', ['telefone' => self::TEL, 'texto' => 'x', 'chave' => 'k'])->json('mensagem.id');
        $this->patchJson("/api/bot/mensagens/{$id}", ['status' => 'enviada', 'meta_message_id' => 'wamid.out'])->assertOk();
        $this->assertDatabaseHas('mensagens_whatsapp', ['id' => $id, 'status' => 'enviada', 'meta_message_id' => 'wamid.out']);
        $this->assertNotNull(MensagemWhatsapp::find($id)->enviada_em);
    }

    public function test_pendentes_traz_entradas_travadas_e_saidas_vencidas(): void
    {
        Carbon::setTestNow('2026-10-05 12:00:00');
        $this->postJson('/api/bot/mensagens/entrada', $this->entrada('wamid.velha'));
        $this->postJson('/api/bot/mensagens/saida', ['telefone' => self::TEL, 'texto' => 'r', 'chave' => 'resp:wamid.velha']);
        $this->postJson('/api/bot/mensagens/saida', ['telefone' => self::TEL, 'texto' => 'n', 'chave' => 'notificacao']);
        Carbon::setTestNow('2026-10-05 12:02:00');
        $this->postJson('/api/bot/mensagens/entrada', $this->entrada('wamid.nova'));

        $resposta = $this->getJson('/api/bot/mensagens/pendentes')->assertOk();
        $this->assertSame(['wamid.velha'], array_column($resposta->json('entradas'), 'wa_message_id'));
        $this->assertTrue($resposta->json('entradas.0.respondida'));
        $this->assertCount(2, $resposta->json('saidas'));
        Carbon::setTestNow();
    }

    public function test_conversa_retorna_estado_historico_e_ultimo_pedido(): void
    {
        $this->postJson('/api/status-conversa/sync', ['telefone' => self::TEL, 'status' => 'coletando_endereco', 'rascunho' => ['pratos' => ['Frango']]]);
        $entrada = $this->postJson('/api/bot/mensagens/entrada', $this->entrada('wamid.a', 'quero frango'))->json('mensagem.id');
        $this->patchJson("/api/bot/mensagens/{$entrada}", ['status' => 'processada']);
        $this->postJson('/api/bot/mensagens/saida', ['telefone' => self::TEL, 'texto' => 'Anotado!', 'chave' => 'resp:wamid.a']);

        $this->getJson('/api/bot/conversas/'.self::TEL)->assertOk()
            ->assertJsonPath('status', 'coletando_endereco')
            ->assertJsonPath('rascunho.pratos.0', 'Frango')
            ->assertJsonPath('historico', [['role' => 'user', 'content' => 'quero frango'], ['role' => 'assistant', 'content' => 'Anotado!']])
            ->assertJsonPath('ultimo_pedido', null);
        $this->getJson('/api/bot/conversas/5512000000000')->assertOk()->assertJsonPath('status', null)->assertJsonPath('historico', []);
    }

    public function test_pedido_sem_codigo_recebe_codigo_do_servidor_e_chave_evita_duplicidade(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-05 12:00', 'America/Sao_Paulo'));
        $categoria = Categoria::create(['nome' => 'Pratos', 'slug' => 'pratos', 'ativo' => true]);
        $variacao = Produto::create(['categoria_id' => $categoria->id, 'tipo' => 'prato_executivo', 'nome' => 'Frango', 'ativo' => true])
            ->variacoes()->create(['tamanho' => 'Grande', 'preco' => 30, 'ativo' => true]);
        $dados = ['telefone' => self::TEL, 'nome' => 'Ana', 'endereco' => 'Rua A', 'formaPagamento' => 'Pix',
            'chave_idempotencia' => 'pedido:wamid.a', 'itens' => [['variacao_id' => $variacao->id, 'quantidade' => 1]]];

        $codigo = $this->postJson('/api/pedidos', $dados)->assertCreated()->json('pedido.codigo_pedido');
        $this->assertMatchesRegularExpression('/^PED-261005-\d{3}$/', $codigo);
        $this->postJson('/api/pedidos', $dados)->assertOk()->assertJsonPath('pedido.codigo_pedido', $codigo);
        $this->assertSame(1, Pedido::count());
        $this->getJson('/api/bot/conversas/'.self::TEL)->assertJsonPath('ultimo_pedido.codigo_pedido', $codigo);
        Carbon::setTestNow();
    }

    public function test_rotas_do_bot_exigem_token(): void
    {
        $this->withHeaders(['Authorization' => 'Bearer errado'])->getJson('/api/bot/mensagens/pendentes')->assertUnauthorized();
    }
}
