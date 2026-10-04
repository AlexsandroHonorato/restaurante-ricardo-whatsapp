<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class HealthTest extends TestCase
{
    protected bool $authenticate = false;

    protected function tearDown(): void
    {
        File::delete(base_path('version.json'));
        parent::tearDown();
    }

    public function test_health_publico_informa_versao_publicada_e_banco(): void
    {
        File::put(base_path('version.json'), json_encode(['application' => 'BotClient', 'commit' => str_repeat('a', 40)]));

        $this->withHeaders(['Authorization' => ''])->getJson('/api/health')
            ->assertOk()
            ->assertExactJson([
                'application' => 'BotClient',
                'status' => 'healthy',
                'database' => 'ok',
                'version' => str_repeat('a', 40),
            ])
            ->assertHeader('Cache-Control', 'no-store, private');
    }

    public function test_health_sem_pacote_publicado_informa_dev(): void
    {
        $this->getJson('/api/health')->assertOk()->assertJsonPath('version', 'dev');
    }

    public function test_health_com_banco_indisponivel_responde_503_sem_detalhes(): void
    {
        DB::shouldReceive('connection->getPdo')->andThrow(new \RuntimeException('senha secreta no erro'));

        $resposta = $this->getJson('/api/health')->assertStatus(503)
            ->assertJsonPath('status', 'unhealthy')
            ->assertJsonPath('database', 'error');
        $this->assertStringNotContainsString('senha', $resposta->getContent());
    }
}
