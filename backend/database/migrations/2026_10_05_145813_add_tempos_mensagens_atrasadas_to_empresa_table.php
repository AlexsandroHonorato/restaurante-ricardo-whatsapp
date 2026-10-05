<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Mensagens que a Meta entrega com atraso (bot fora do ar ou webhook recusado): acima de
     * minutos_mensagem_antiga o bot não responde; acima de minutos_fila_acumulada responde só a primeira do cliente.
     */
    public function up(): void
    {
        Schema::table('empresa', function (Blueprint $table) {
            $table->unsignedSmallInteger('minutos_mensagem_antiga')->default(10);
            $table->unsignedSmallInteger('minutos_fila_acumulada')->default(1);
        });
    }

    public function down(): void
    {
        Schema::table('empresa', function (Blueprint $table) {
            $table->dropColumn(['minutos_mensagem_antiga', 'minutos_fila_acumulada']);
        });
    }
};
