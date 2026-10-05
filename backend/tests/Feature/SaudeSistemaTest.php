<?php

namespace Tests\Feature;

use App\Models\MensagemWhatsapp;
use App\Models\StatusConversa;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class SaudeSistemaTest extends TestCase
{
    use RefreshDatabase;

    private function botNoAr(): void
    {
        Http::fake(['127.0.0.1:3000/*' => Http::response('agente no ar')]);
    }

    private function saida(array $dados): MensagemWhatsapp
    {
        static $n = 0;

        return MensagemWhatsapp::create([
            'direcao' => 'saida', 'telefone' => '5512999990001', 'texto' => 'x', 'chave' => 'k'.(++$n), 'status' => 'pendente', ...$dados,
        ]);
    }

    private function codigos(): array
    {
        return array_column($this->getJson('/api/sistema/saude')->assertOk()->json('problemas'), 'codigo');
    }

    public function test_sistema_saudavel_nao_tem_problemas(): void
    {
        $this->botNoAr();
        $this->getJson('/api/sistema/saude')->assertOk()->assertJsonPath('status', 'ok')->assertJsonPath('problemas', []);
    }

    public function test_bot_fora_do_ar_aparece_no_painel_e_derruba_o_health(): void
    {
        Http::fake(fn () => throw new ConnectionException('recusado'));
        $this->assertSame(['bot_fora_do_ar'], $this->codigos());
        $this->getJson('/api/health')->assertStatus(503)->assertJsonPath('bot', 'error')->assertJsonPath('status', 'unhealthy');
    }

    public function test_token_da_meta_recusado_e_detectado_pelas_ultimas_falhas(): void
    {
        $this->botNoAr();
        $this->saida(['erro' => 'WhatsApp HTTP 401: Authentication Error', 'tentativas' => 1, 'proxima_tentativa_em' => now()->addMinute()]);
        $this->assertContains('whatsapp_token', $this->codigos());
        // Um envio bem-sucedido depois da falha indica que o token voltou a funcionar.
        $this->saida(['status' => 'enviada', 'enviada_em' => now()->addSecond()]);
        $this->assertNotContains('whatsapp_token', $this->codigos());
    }

    public function test_falhas_definitivas_fila_atrasada_e_entradas_sem_resposta(): void
    {
        $this->botNoAr();
        Carbon::setTestNow('2026-10-05 12:00:00');
        $this->saida(['status' => 'falhou', 'erro' => 'WhatsApp HTTP 500']);
        $this->saida(['tentativas' => 2, 'proxima_tentativa_em' => now()->addMinutes(10)]);
        MensagemWhatsapp::create(['direcao' => 'entrada', 'telefone' => '5512999990002', 'wa_message_id' => 'w1', 'texto' => 'oi', 'status' => 'pendente']);
        Carbon::setTestNow('2026-10-05 12:11:00');
        $this->assertEqualsCanonicalizing(['envios_falharam', 'fila_atrasada', 'entradas_sem_resposta'], $this->codigos());

        // Cada aviso lista as mensagens dele, para a equipe abrir a conversa.
        $this->getJson('/api/sistema/saude/envios_falharam')->assertOk()->assertJsonCount(1)
            ->assertJsonPath('0.telefone', '5512999990001')->assertJsonPath('0.erro', 'WhatsApp HTTP 500')->assertJsonPath('0.direcao', 'saida');
        $this->getJson('/api/sistema/saude/entradas_sem_resposta')->assertOk()->assertJsonCount(1)->assertJsonPath('0.texto', 'oi');
        $this->getJson('/api/sistema/saude/bot_fora_do_ar')->assertNotFound();
        Carbon::setTestNow();
    }

    public function test_envio_que_falhou_sai_do_aviso_quando_o_cliente_e_atendido_ou_a_conversa_e_excluida(): void
    {
        $this->botNoAr();
        $this->saida(['status' => 'falhou', 'erro' => 'WhatsApp HTTP 500']);
        $this->saida(['status' => 'falhou', 'telefone' => '5512999990002']);
        $this->assertContains('envios_falharam', $this->codigos());
        $this->getJson('/api/sistema/saude/envios_falharam')->assertJsonCount(2);

        // Mensagem posterior entregue ao primeiro cliente: o envio antigo dele deixa de ser pendência.
        $this->saida(['status' => 'enviada', 'enviada_em' => now()]);
        $this->getJson('/api/sistema/saude/envios_falharam')->assertJsonCount(1)->assertJsonPath('0.telefone', '5512999990002');

        // Excluir a conversa do segundo cliente no monitor limpa o aviso dele.
        $id = StatusConversa::create(['telefone' => '5512999990002', 'status_atual' => 'transbordo_humano'])->id;
        $this->deleteJson("/api/status-conversa/{$id}")->assertOk();
        $this->assertNotContains('envios_falharam', $this->codigos());
    }

    public function test_verificacao_agendada_envia_email_uma_vez_por_conjunto_de_problemas(): void
    {
        Mail::fake();
        config(['services.alertas.email' => 'dono@exemplo.com.br']);
        Http::fake(fn () => throw new ConnectionException('recusado'));
        $this->artisan('botclient:verificar-saude')->assertSuccessful();
        $this->artisan('botclient:verificar-saude')->assertSuccessful();
        Mail::assertSentCount(1);

        $this->saida(['status' => 'falhou']);
        $this->artisan('botclient:verificar-saude')->assertSuccessful();
        Mail::assertSentCount(2);
    }

    public function test_sem_email_configurado_a_verificacao_nao_envia(): void
    {
        Mail::fake();
        config(['services.alertas.email' => null]);
        Http::fake(fn () => throw new ConnectionException('recusado'));
        $this->artisan('botclient:verificar-saude')->assertSuccessful();
        Mail::assertNothingSent();
    }
}
