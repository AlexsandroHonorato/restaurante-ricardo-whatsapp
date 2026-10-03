<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HorarioAtendimentoTest extends TestCase
{
    use RefreshDatabase;

    public function test_tabela_tem_os_sete_dias_com_horario_atual(): void
    {
        $this->getJson('/api/horarios-atendimento')->assertOk()
            ->assertJsonCount(7, 'horarios')
            ->assertJsonPath('horarios.0.dia_semana', 1)
            ->assertJsonPath('horarios.0.hora_inicio', '11:00:00')
            ->assertJsonPath('horarios.0.hora_fim', '14:30:00')
            ->assertJsonPath('horarios.6.nome_dia', 'Domingo')
            ->assertJsonPath('horarios.6.ativo', false);
    }

    public function test_pode_ativar_domingo_e_desativar_segunda(): void
    {
        $this->putJson('/api/horarios-atendimento/7', ['ativo' => true, 'hora_inicio' => '12:00', 'hora_fim' => '15:00'])->assertOk();
        $this->assertDatabaseHas('horarios_atendimento', ['dia_semana' => 7, 'ativo' => true, 'hora_inicio' => '12:00:00', 'hora_fim' => '15:00:00']);
        $this->putJson('/api/horarios-atendimento/1', ['ativo' => false])->assertOk();
        $this->assertDatabaseHas('horarios_atendimento', ['dia_semana' => 1, 'ativo' => false, 'hora_inicio' => null, 'hora_fim' => null]);
        $this->assertDatabaseCount('horarios_atendimento', 7);
    }

    public function test_recusa_intervalo_invertido_ou_incompleto_e_dia_inexistente(): void
    {
        $this->putJson('/api/horarios-atendimento/1', ['ativo' => true, 'hora_inicio' => '15:00', 'hora_fim' => '11:00'])->assertUnprocessable();
        $this->putJson('/api/horarios-atendimento/1', ['ativo' => true])->assertUnprocessable();
        $this->putJson('/api/horarios-atendimento/8', ['ativo' => false])->assertNotFound();
        $this->assertDatabaseHas('horarios_atendimento', ['dia_semana' => 1, 'hora_inicio' => '11:00:00']);
    }
}
