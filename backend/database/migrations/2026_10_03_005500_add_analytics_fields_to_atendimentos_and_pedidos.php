<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('atendimentos', function (Blueprint $table) {
            $table->string('etapa_abandono', 80)->nullable();
        });
        Schema::table('pedidos', function (Blueprint $table) {
            $table->string('motivo_cancelamento', 255)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('atendimentos', fn (Blueprint $table) => $table->dropColumn('etapa_abandono'));
        Schema::table('pedidos', fn (Blueprint $table) => $table->dropColumn('motivo_cancelamento'));
    }
};
