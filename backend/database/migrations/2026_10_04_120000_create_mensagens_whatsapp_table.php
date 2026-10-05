<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Caixa de entrada/saída durável do WhatsApp: nenhuma mensagem é confirmada à Meta antes de gravada
     * e nenhuma resposta se perde se o envio falhar (reenvio com intervalo crescente).
     */
    public function up(): void
    {
        Schema::create('mensagens_whatsapp', function (Blueprint $table) {
            $table->id();
            $table->string('direcao', 8);
            $table->string('telefone', 20);
            $table->string('wa_message_id', 150)->nullable()->unique();
            $table->string('chave', 150)->nullable()->unique();
            $table->string('tipo', 20)->default('text');
            $table->text('texto')->nullable();
            $table->string('status', 15);
            $table->unsignedSmallInteger('tentativas')->default(0);
            $table->timestamp('proxima_tentativa_em')->nullable();
            $table->string('erro', 255)->nullable();
            $table->string('meta_message_id', 150)->nullable();
            $table->timestamp('processada_em')->nullable();
            $table->timestamp('enviada_em')->nullable();
            $table->timestamps();
            $table->index(['telefone', 'id']);
            $table->index(['direcao', 'status', 'proxima_tentativa_em']);
        });

        Schema::table('pedidos', function (Blueprint $table) {
            $table->string('chave_idempotencia', 150)->nullable()->unique()->after('codigo_pedido');
        });
    }

    public function down(): void
    {
        Schema::table('pedidos', function (Blueprint $table) {
            $table->dropUnique(['chave_idempotencia']);
            $table->dropColumn('chave_idempotencia');
        });
        Schema::dropIfExists('mensagens_whatsapp');
    }
};
