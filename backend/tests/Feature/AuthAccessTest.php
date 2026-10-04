<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthAccessTest extends TestCase
{
    use RefreshDatabase;

    protected bool $authenticate = false;

    public function test_api_requires_login_and_bot_requires_separate_secret(): void
    {
        $this->getJson('/api/dashboard/kpis')->assertUnauthorized();
        $this->withHeaders(['Authorization' => 'Bearer errado'])->getJson('/api/cardapio/texto')->assertUnauthorized();
        $this->withHeaders(['Authorization' => 'Bearer '.str_repeat('t', 64)])->getJson('/api/bot/horarios-atendimento')->assertOk();
    }

    public function test_login_logout_and_generic_invalid_credentials(): void
    {
        $user = User::factory()->create(['email' => 'admin@example.com', 'password' => 'Senha123!', 'role' => 'admin']);
        $this->postJson('/api/auth/login', ['email' => 'admin@example.com', 'password' => 'errada'])->assertStatus(422)->assertJsonPath('message', 'E-mail ou senha inválidos.');
        $this->postJson('/api/auth/login', ['email' => 'ADMIN@example.com', 'password' => 'Senha123!'])->assertOk()->assertJsonMissing(['password']);
        $this->getJson('/api/auth/me')->assertOk()->assertJsonPath('user.id', $user->id);
        $this->postJson('/api/auth/logout')->assertOk();
        $this->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_inactive_user_denied_and_login_rate_limited(): void
    {
        User::factory()->create(['email' => 'inactive@example.com', 'password' => 'Senha123!', 'active' => false]);
        $this->postJson('/api/auth/login', ['email' => 'inactive@example.com', 'password' => 'Senha123!'])->assertStatus(422);
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/login', ['email' => 'missing@example.com', 'password' => 'Senha123!'])->assertStatus(422);
        }
        $this->postJson('/api/auth/login', ['email' => 'missing@example.com', 'password' => 'Senha123!'])->assertStatus(429);
    }

    public function test_only_admin_creates_users_and_password_is_hashed(): void
    {
        $operador = User::factory()->create(['role' => 'operador', 'active' => true]);
        $dados = ['name' => 'Ana Silva', 'email' => 'ana@example.com', 'role' => 'operador', 'active' => true, 'password' => 'Senha123!', 'password_confirmation' => 'Senha123!'];
        $this->actingAs($operador)->postJson('/api/usuarios', $dados)->assertForbidden();
        $admin = User::factory()->create(['role' => 'admin', 'active' => true]);
        $this->actingAs($admin)->postJson('/api/usuarios', array_merge($dados, ['password' => 'senha123', 'password_confirmation' => 'senha123']))->assertUnprocessable();
        $this->postJson('/api/usuarios', $dados)->assertCreated()->assertJsonMissing(['password' => 'Senha123!']);
        $criado = User::where('email', 'ana@example.com')->firstOrFail();
        $this->assertTrue(Hash::check('Senha123!', $criado->password));
        $this->postJson('/api/usuarios', $dados)->assertUnprocessable();
    }
}
