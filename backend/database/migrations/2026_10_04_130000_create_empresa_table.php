<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Ficha da empresa (uma linha): editada no painel e lida pelo bot. Campos vazios = usar negocio.md/.env. */
    public function up(): void
    {
        Schema::create('empresa', function (Blueprint $table) {
            $table->id();
            $table->string('nome', 150)->nullable();
            $table->string('telefone', 30)->nullable();
            $table->string('telefone_2', 30)->nullable();
            $table->string('endereco', 255)->nullable();
            $table->text('quem_somos')->nullable();
            $table->text('formas_pagamento')->nullable();
            $table->text('politicas')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('empresa');
    }
};
