<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Perfis de usuário: o que cada pessoa vê e faz no painel. O Administrador (users.role = admin) não é um
     * perfil desta tabela: tem acesso total e não pode ser editado, para ninguém ficar trancado fora.
     */
    public function up(): void
    {
        Schema::create('perfis', function (Blueprint $table) {
            $table->id();
            $table->string('nome', 60)->unique();
            // {"pedidos": ["ver", "editar"], ...}: telas e ações de App\Support\Permissoes.
            $table->json('permissoes');
            // Perfil de quem não tem outro escolhido; não pode ser excluído.
            $table->boolean('padrao')->default(false);
            $table->timestamps();
        });
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('perfil_id')->nullable()->constrained('perfis')->nullOnDelete();
        });

        // Mesmo acesso que o operador já tinha: Pedidos, Atendimentos e Clientes.
        $operador = DB::table('perfis')->insertGetId([
            'nome' => 'Operador',
            'permissoes' => json_encode(['pedidos' => ['ver', 'editar'], 'atendimentos' => ['ver', 'editar', 'excluir'], 'clientes' => ['ver']]),
            'padrao' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('users')->where('role', '!=', 'admin')->update(['perfil_id' => $operador]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('perfil_id');
        });
        Schema::dropIfExists('perfis');
    }
};
