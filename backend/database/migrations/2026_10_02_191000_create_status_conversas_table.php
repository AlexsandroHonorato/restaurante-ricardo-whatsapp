<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('status_conversas')) {
            Schema::create('status_conversas', function (Blueprint $table) {
                $table->id();
                $table->string('telefone', 30)->unique()->index();
                $table->string('status_atual', 50)->default('conversa_iniciada')->index();
                $table->string('status_anterior', 50)->nullable();
                $table->json('rascunho')->nullable();
                $table->timestamp('ultimo_contato_em')->useCurrent()->useCurrentOnUpdate();
                $table->timestamp('expira_em')->nullable();
                $table->timestamps();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('status_conversas');
    }
};
