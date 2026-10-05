<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class UsuariosGestaoTest extends TestCase
{
    use RefreshDatabase;

    private function dados(User $u, array $mudancas = []): array
    {
        $u = $u->fresh();

        return [...['name' => $u->name, 'email' => $u->email, 'phone' => $u->phone, 'role' => $u->role, 'active' => $u->active], ...$mudancas];
    }

    private function sessaoDe(User $u): void
    {
        DB::table('sessions')->insert(['id' => 'sessao-'.$u->id, 'user_id' => $u->id, 'payload' => '', 'last_activity' => time()]);
    }

    public function test_edita_dados_mantendo_senha_quando_em_branco(): void
    {
        $u = User::factory()->create(['role' => 'operador', 'password' => 'Antiga#123']);
        $this->putJson("/api/usuarios/{$u->id}", $this->dados($u, ['name' => 'Ana Lima', 'phone' => '(12) 99750-0045', 'password' => '']))
            ->assertOk()->assertJsonPath('user.name', 'Ana Lima')->assertJsonMissing(['password']);
        $this->assertSame('(12) 99750-0045', $u->fresh()->phone);
        $this->assertTrue(Hash::check('Antiga#123', $u->fresh()->password));
    }

    public function test_troca_de_senha_exige_politica_e_derruba_sessoes(): void
    {
        $u = User::factory()->create(['role' => 'operador']);
        $this->sessaoDe($u);
        $this->putJson("/api/usuarios/{$u->id}", $this->dados($u, ['password' => 'fraca', 'password_confirmation' => 'fraca']))
            ->assertUnprocessable()->assertJsonValidationErrors('password');
        $this->assertSame(1, DB::table('sessions')->where('user_id', $u->id)->count());

        $this->putJson("/api/usuarios/{$u->id}", $this->dados($u, ['password' => 'Nova#Senha1', 'password_confirmation' => 'Nova#Senha1']))->assertOk();
        $this->assertTrue(Hash::check('Nova#Senha1', $u->fresh()->password));
        $this->assertSame(0, DB::table('sessions')->where('user_id', $u->id)->count());
    }

    public function test_email_repetido_e_recusado(): void
    {
        User::factory()->create(['email' => 'ja@x.com']);
        $u = User::factory()->create();
        $this->putJson("/api/usuarios/{$u->id}", $this->dados($u, ['email' => 'JA@x.com']))->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->putJson("/api/usuarios/{$u->id}", $this->dados($u))->assertOk(); // o próprio e-mail continua valendo
    }

    public function test_admin_nao_rebaixa_desativa_nem_exclui_a_si_mesmo(): void
    {
        $eu = Auth::user();
        User::factory()->create(['role' => 'admin', 'active' => true]);
        $this->putJson("/api/usuarios/{$eu->id}", $this->dados($eu, ['role' => 'operador']))->assertUnprocessable();
        $this->putJson("/api/usuarios/{$eu->id}", $this->dados($eu, ['active' => false]))->assertUnprocessable();
        $this->deleteJson("/api/usuarios/{$eu->id}")->assertUnprocessable();
        $this->assertSame('admin', $eu->fresh()->role);
    }

    public function test_admin_rebaixa_e_desativa_outro_admin_e_o_sistema_mantem_um_admin(): void
    {
        $eu = Auth::user();
        $outro = User::factory()->create(['role' => 'admin', 'active' => true]);
        $this->sessaoDe($outro);
        $this->putJson("/api/usuarios/{$outro->id}", $this->dados($outro, ['role' => 'operador', 'active' => false]))->assertOk();
        $this->assertSame(0, DB::table('sessions')->where('user_id', $outro->id)->count(), 'desativado perde a sessão');
        $this->assertTrue(User::where('role', 'admin')->where('active', true)->whereKey($eu->id)->exists());
    }

    public function test_exclui_usuario_e_encerra_a_sessao(): void
    {
        $u = User::factory()->create(['role' => 'operador']);
        $this->sessaoDe($u);
        $this->deleteJson("/api/usuarios/{$u->id}")->assertOk();
        $this->assertModelMissing($u);
        $this->assertSame(0, DB::table('sessions')->where('user_id', $u->id)->count());
        $this->deleteJson('/api/usuarios/999999')->assertNotFound();
    }

    public function test_operador_nao_edita_nem_exclui(): void
    {
        $alvo = User::factory()->create(['role' => 'operador']);
        $this->actingAs(User::factory()->create(['role' => 'operador', 'active' => true]));
        $this->putJson("/api/usuarios/{$alvo->id}", $this->dados($alvo, ['role' => 'admin']))->assertForbidden();
        $this->deleteJson("/api/usuarios/{$alvo->id}")->assertForbidden();
        $this->assertSame('operador', $alvo->fresh()->role);
    }
}
