<?php

namespace Tests\Feature;

use App\Models\Perfil;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** Perfis de usuário: telas e ações liberadas por perfil, conferidas na API. Administrador é fixo e tem tudo. */
class PerfisUsuarioTest extends TestCase
{
    use RefreshDatabase;

    private function como(array $permissoes, string $nome = 'Teste'): User
    {
        $perfil = Perfil::create(['nome' => $nome, 'permissoes' => $permissoes]);
        $usuario = User::factory()->create(['role' => 'operador', 'active' => true, 'perfil_id' => $perfil->id]);
        $this->actingAs($usuario);

        return $usuario;
    }

    public function test_administrador_cria_edita_e_exclui_perfil_com_permissoes_normalizadas(): void
    {
        $resposta = $this->postJson('/api/perfis', ['nome' => 'Cozinha', 'permissoes' => [
            'pedidos' => ['editar'], 'dashboard' => ['ver', 'excluir'], 'tela_inventada' => ['ver'], 'clientes' => [],
        ]])->assertCreated();
        // "editar" traz "ver"; ação e tela fora do catálogo são descartadas.
        $resposta->assertJsonPath('perfil.permissoes', ['dashboard' => ['ver'], 'pedidos' => ['ver', 'editar']]);
        $id = $resposta->json('perfil.id');

        $this->putJson("/api/perfis/{$id}", ['nome' => 'Cozinha', 'permissoes' => ['pedidos' => ['ver']]])->assertOk()
            ->assertJsonPath('perfil.permissoes', ['pedidos' => ['ver']]);
        $lista = $this->getJson('/api/perfis')->assertOk();
        $this->assertSame(['Operador', 'Cozinha'], array_column($lista->json('perfis'), 'nome'));
        $this->assertSame(['ver', 'editar', 'excluir'], $lista->json('telas.pedidos'));

        $this->postJson('/api/perfis', ['nome' => 'Cozinha', 'permissoes' => ['pedidos' => ['ver']]])->assertUnprocessable();
        $this->postJson('/api/perfis', ['nome' => 'Administrador', 'permissoes' => ['pedidos' => ['ver']]])->assertUnprocessable();
        $this->postJson('/api/perfis', ['nome' => 'Vazio', 'permissoes' => []])->assertUnprocessable();

        $this->deleteJson("/api/perfis/{$id}")->assertOk();
        $this->assertNull(Perfil::find($id));
    }

    public function test_perfil_padrao_ou_em_uso_nao_e_excluido(): void
    {
        $padrao = Perfil::where('padrao', true)->firstOrFail();
        $this->deleteJson("/api/perfis/{$padrao->id}")->assertUnprocessable();

        $perfil = Perfil::create(['nome' => 'Gerente', 'permissoes' => ['dashboard' => ['ver']]]);
        User::factory()->create(['role' => 'operador', 'active' => true, 'perfil_id' => $perfil->id]);
        $this->deleteJson("/api/perfis/{$perfil->id}")->assertUnprocessable()->assertJsonValidationErrors('perfil');
        $this->assertNotNull(Perfil::find($perfil->id));
    }

    public function test_login_devolve_nome_do_perfil_e_permissoes(): void
    {
        $this->getJson('/api/auth/me')->assertOk()->assertJsonPath('user.perfil_nome', 'Administrador')
            ->assertJsonPath('user.permissoes.usuarios', ['ver', 'criar', 'editar', 'excluir']);

        $this->como(['pedidos' => ['ver']], 'Cozinha');
        $this->getJson('/api/auth/me')->assertOk()->assertJsonPath('user.perfil_nome', 'Cozinha')
            ->assertJsonPath('user.permissoes', ['pedidos' => ['ver']]);

        // Sem perfil escolhido vale o padrão (Operador).
        $this->actingAs(User::factory()->create(['role' => 'operador', 'active' => true]));
        $this->getJson('/api/auth/me')->assertJsonPath('user.perfil_nome', 'Operador')
            ->assertJsonPath('user.permissoes.pedidos', ['ver', 'editar']);
    }

    public function test_api_libera_so_as_telas_e_acoes_do_perfil(): void
    {
        Http::fake(['*' => Http::response(['ok' => true])]);
        $this->como(['pedidos' => ['ver'], 'cardapio' => ['ver', 'editar'], 'empresa' => ['ver']]);

        // Ver sem editar.
        $this->getJson('/api/pedidos')->assertOk();
        $this->patchJson('/api/pedidos/1/status', ['status' => 'em_preparo'])->assertForbidden();
        $this->getJson('/api/empresa')->assertOk();
        $this->putJson('/api/empresa', ['nome' => 'X'])->assertForbidden();
        // Editar sem criar nem excluir.
        $this->getJson('/api/cardapio')->assertOk();
        $this->postJson('/api/cardapio/produtos', [])->assertForbidden();
        $this->deleteJson('/api/cardapio/produtos/1')->assertForbidden();
        $this->patchJson('/api/cardapio/produtos/999/toggle')->assertNotFound();
        // Telas fora do perfil.
        $this->getJson('/api/clientes')->assertForbidden();
        $this->getJson('/api/status-conversa')->assertForbidden();
        $this->getJson('/api/conversas/5512999990001/mensagens')->assertForbidden();
        $this->getJson('/api/dashboard/analises')->assertForbidden();
        $this->getJson('/api/usuarios')->assertForbidden();
        $this->getJson('/api/perfis')->assertForbidden();
        // Usados pelo cabeçalho e pelo menu: abertos a todos.
        $this->getJson('/api/dashboard/kpis')->assertOk();
        $this->getJson('/api/horarios-atendimento')->assertOk();
        $this->getJson('/api/sistema/saude')->assertOk();
    }

    public function test_quem_gerencia_usuarios_sem_ser_administrador_nao_escala_privilegio(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'active' => true]);
        $gerente = $this->como(['usuarios' => ['ver', 'criar', 'editar', 'excluir']], 'Gerente');
        $novo = ['name' => 'Ana Lima', 'email' => 'ana@exemplo.com', 'phone' => null, 'active' => true, 'password' => 'Senha@Forte1', 'password_confirmation' => 'Senha@Forte1'];

        // Cria usuário comum com um perfil, vê a lista de perfis, mas não mexe em perfis.
        $this->postJson('/api/usuarios', [...$novo, 'role' => 'operador', 'perfil_id' => $gerente->perfil_id])->assertCreated()
            ->assertJsonPath('user.perfil_id', $gerente->perfil_id);
        $this->getJson('/api/perfis')->assertOk();
        $this->postJson('/api/perfis', ['nome' => 'Tudo', 'permissoes' => ['dashboard' => ['ver']]])->assertForbidden();

        // Não cria administrador, não altera nem exclui administrador, não troca o próprio perfil.
        $this->postJson('/api/usuarios', [...$novo, 'email' => 'b@exemplo.com', 'role' => 'admin'])->assertForbidden();
        $dadosAdmin = ['name' => $admin->name, 'email' => $admin->email, 'phone' => null, 'role' => 'operador', 'perfil_id' => null, 'active' => true];
        $this->putJson("/api/usuarios/{$admin->id}", $dadosAdmin)->assertForbidden();
        $this->deleteJson("/api/usuarios/{$admin->id}")->assertForbidden();
        $this->assertSame('admin', $admin->fresh()->role);
        $outro = Perfil::create(['nome' => 'Outro', 'permissoes' => ['dashboard' => ['ver']]]);
        $eu = ['name' => $gerente->name, 'email' => $gerente->email, 'phone' => null, 'role' => 'operador', 'active' => true];
        $this->putJson("/api/usuarios/{$gerente->id}", [...$eu, 'perfil_id' => $outro->id])->assertUnprocessable();
        $this->putJson("/api/usuarios/{$gerente->id}", [...$eu, 'perfil_id' => $gerente->perfil_id, 'name' => 'Novo Nome'])->assertOk();
    }

    public function test_administrador_troca_perfil_do_usuario_e_virar_administrador_limpa_o_perfil(): void
    {
        $perfil = Perfil::create(['nome' => 'Cozinha', 'permissoes' => ['pedidos' => ['ver']]]);
        $usuario = User::factory()->create(['role' => 'operador', 'active' => true]);
        $dados = ['name' => $usuario->name, 'email' => $usuario->email, 'phone' => null, 'active' => true];

        $this->putJson("/api/usuarios/{$usuario->id}", [...$dados, 'role' => 'operador', 'perfil_id' => $perfil->id])->assertOk();
        $this->assertSame($perfil->id, $usuario->fresh()->perfil_id);
        $this->putJson("/api/usuarios/{$usuario->id}", [...$dados, 'role' => 'operador', 'perfil_id' => 99999])->assertUnprocessable();
        $this->putJson("/api/usuarios/{$usuario->id}", [...$dados, 'role' => 'admin', 'perfil_id' => $perfil->id])->assertOk();
        $this->assertNull($usuario->fresh()->perfil_id);

        // A lista de usuários traz o nome do perfil de cada um.
        $cozinheiro = User::factory()->create(['role' => 'operador', 'active' => true, 'perfil_id' => $perfil->id]);
        $naLista = collect($this->getJson('/api/usuarios')->assertOk()->json('data.data'))->firstWhere('id', $cozinheiro->id);
        $this->assertSame('Cozinha', $naLista['perfil']['nome']);
    }
}
