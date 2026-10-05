<?php

namespace Tests\Feature;

use App\Models\MensagemWhatsapp;
use App\Models\StatusConversa;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** Atendimento humano pelo painel: histórico, resposta do atendente e pausa do bot na conversa. */
class ConversaPainelTest extends TestCase
{
    use RefreshDatabase;

    private const TEL = '5512999990001';

    public function test_historico_mostra_entrada_e_saida_em_ordem_com_autor(): void
    {
        MensagemWhatsapp::create(['direcao' => 'entrada', 'telefone' => self::TEL, 'wa_message_id' => 'w1', 'texto' => 'Quero falar com alguém', 'status' => 'processada']);
        MensagemWhatsapp::create(['direcao' => 'saida', 'telefone' => self::TEL, 'chave' => 'humano:1', 'texto' => 'Oi, sou a Ana!', 'status' => 'enviada', 'enviada_por' => 'Ana']);
        $this->getJson('/api/conversas/'.self::TEL.'/mensagens')->assertOk()
            ->assertJsonPath('mensagens.0.texto', 'Quero falar com alguém')
            ->assertJsonPath('mensagens.1.enviada_por', 'Ana')
            ->assertJsonPath('bot_pausado_ate', null);
    }

    public function test_atendente_responde_pela_saida_duravel_e_bot_pausa_por_duas_horas(): void
    {
        Carbon::setTestNow('2026-10-05 12:00:00');
        Http::fake(['*' => Http::response(['ok' => true, 'enviado' => true])]);
        $this->postJson('/api/conversas/'.self::TEL.'/mensagens', ['texto' => 'Olá! Aqui é da equipe.'])->assertCreated()
            ->assertJsonPath('enviado', true);

        $saida = MensagemWhatsapp::where('direcao', 'saida')->firstOrFail();
        $this->assertStringStartsWith('humano:', $saida->chave);
        $this->assertSame('Olá! Aqui é da equipe.', $saida->texto);
        $this->assertSame(auth()->user()->name, $saida->enviada_por);
        Http::assertSent(fn ($r) => $r['idempotency_key'] === $saida->chave && $r['para'] === self::TEL);
        $this->assertEquals(now()->addHours(2), StatusConversa::where('telefone', self::TEL)->first()->bot_pausado_ate);
        $this->getJson('/api/bot/conversas/'.self::TEL.'/pausa')->assertOk()->assertJsonPath('pausado', true);
        Carbon::setTestNow('2026-10-05 14:00:01');
        $this->getJson('/api/bot/conversas/'.self::TEL.'/pausa')->assertJsonPath('pausado', false);
        Carbon::setTestNow();
    }

    public function test_bot_fora_do_ar_mantem_mensagem_na_fila_para_reenvio(): void
    {
        Http::fake(fn () => throw new ConnectionException('recusado'));
        $this->postJson('/api/conversas/'.self::TEL.'/mensagens', ['texto' => 'Oi'])->assertCreated()->assertJsonPath('enviado', false);
        $this->assertSame('pendente', MensagemWhatsapp::firstOrFail()->status);
    }

    public function test_pausar_e_devolver_ao_bot(): void
    {
        $this->postJson('/api/conversas/'.self::TEL.'/pausa', ['pausar' => true])->assertOk();
        $this->getJson('/api/bot/conversas/'.self::TEL.'/pausa')->assertJsonPath('pausado', true);
        $this->postJson('/api/conversas/'.self::TEL.'/pausa', ['pausar' => false])->assertOk()->assertJsonPath('bot_pausado_ate', null);
        $this->getJson('/api/bot/conversas/'.self::TEL.'/pausa')->assertJsonPath('pausado', false);
    }

    public function test_validacao_de_texto_e_telefone(): void
    {
        $this->postJson('/api/conversas/'.self::TEL.'/mensagens', ['texto' => '   '])->assertUnprocessable();
        $this->getJson('/api/conversas/abc/mensagens')->assertNotFound();
    }
}
