<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Perfil do bot: vocabulário e etapas do atendimento (restaurante = fluxo atual; loja = sem etapa de bebidas). */
    public function up(): void
    {
        Schema::table('empresa', function (Blueprint $table) {
            $table->string('tipo_negocio', 20)->default('restaurante')->after('nome');
        });
    }

    public function down(): void
    {
        Schema::table('empresa', function (Blueprint $table) {
            $table->dropColumn('tipo_negocio');
        });
    }
};
