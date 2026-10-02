<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('status_pedidos')) {
            Schema::create('status_pedidos', function (Blueprint $table) {
                $table->id();
                $table->string('codigo', 50)->unique()->index(); // pendente, confirmado, em_preparo, saiu_para_entrega, entregue, cancelado
                $table->string('nome', 100);                    // Nome legível para exibição
                $table->text('descricao')->nullable();          // Descrição do que significa o status
                $table->string('cor_badge', 20)->default('#6B7280'); // Cor visual hexadecimal para UI
                $table->string('icone', 50)->nullable();        // Ícone visual ou emoji
                $table->unsignedInteger('ordem')->default(0);   // Ordem de exibição no fluxo
                $table->boolean('ativo')->default(true)->index();
                $table->timestamps();
            });

            // Popula os status oficiais do restaurante
            DB::table('status_pedidos')->insert([
                [
                    'codigo' => 'pendente',
                    'nome' => 'Pendente',
                    'descricao' => 'Pedido registrado pelo cliente e aguardando confirmação da cozinha.',
                    'cor_badge' => '#F59E0B',
                    'icone' => '⏳',
                    'ordem' => 1,
                    'ativo' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
                [
                    'codigo' => 'confirmado',
                    'nome' => 'Confirmado',
                    'descricao' => 'Pedido aceito e comanda enviada para produção.',
                    'cor_badge' => '#3B82F6',
                    'icone' => '📋',
                    'ordem' => 2,
                    'ativo' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
                [
                    'codigo' => 'em_preparo',
                    'nome' => 'Em Preparo',
                    'descricao' => 'Refeição sendo montada e preparada pela equipe da cozinha.',
                    'cor_badge' => '#8B5CF6',
                    'icone' => '👨‍🍳',
                    'ordem' => 3,
                    'ativo' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
                [
                    'codigo' => 'saiu_para_entrega',
                    'nome' => 'Saiu para Entrega',
                    'descricao' => 'Pedido despachado e a caminho do endereço com o motoboy.',
                    'cor_badge' => '#06B6D4',
                    'icone' => '🛵',
                    'ordem' => 4,
                    'ativo' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
                [
                    'codigo' => 'entregue',
                    'nome' => 'Entregue',
                    'descricao' => 'Pedido entregue com sucesso ao cliente.',
                    'cor_badge' => '#10B981',
                    'icone' => '✅',
                    'ordem' => 5,
                    'ativo' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
                [
                    'codigo' => 'cancelado',
                    'nome' => 'Cancelado',
                    'descricao' => 'Pedido cancelado por inatividade ou solicitação.',
                    'cor_badge' => '#EF4444',
                    'icone' => '❌',
                    'ordem' => 6,
                    'ativo' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('status_pedidos');
    }
};
