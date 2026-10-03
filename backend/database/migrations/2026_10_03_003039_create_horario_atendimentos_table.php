<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('horarios_atendimento', function (Blueprint $table) {
            $table->id();
            $table->unsignedTinyInteger('dia_semana')->unique();
            $table->boolean('ativo')->default(false);
            $table->time('hora_inicio')->nullable();
            $table->time('hora_fim')->nullable();
            $table->timestamps();
        });
        $horarios = [];
        for ($dia = 1; $dia <= 7; $dia++) {
            $horarios[] = [
                'dia_semana' => $dia, 'ativo' => $dia !== 7,
                'hora_inicio' => $dia !== 7 ? '11:00:00' : null,
                'hora_fim' => $dia !== 7 ? '14:30:00' : null,
                'created_at' => now(), 'updated_at' => now(),
            ];
        }
        DB::table('horarios_atendimento')->insert($horarios);
    }

    public function down(): void
    {
        Schema::dropIfExists('horarios_atendimento');
    }
};
