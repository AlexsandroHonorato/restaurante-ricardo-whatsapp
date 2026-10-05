<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Atendimento humano pelo painel: pausa do bot por conversa e autor das mensagens enviadas pela equipe. */
    public function up(): void
    {
        Schema::table('status_conversas', function (Blueprint $table) {
            $table->timestamp('bot_pausado_ate')->nullable();
        });
        Schema::table('mensagens_whatsapp', function (Blueprint $table) {
            $table->string('enviada_por', 150)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('status_conversas', function (Blueprint $table) {
            $table->dropColumn('bot_pausado_ate');
        });
        Schema::table('mensagens_whatsapp', function (Blueprint $table) {
            $table->dropColumn('enviada_por');
        });
    }
};
