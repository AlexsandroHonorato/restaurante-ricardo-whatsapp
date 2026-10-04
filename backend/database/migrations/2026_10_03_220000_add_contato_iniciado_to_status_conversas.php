<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('status_conversas', function (Blueprint $table) {
            $table->timestamp('contato_iniciado_em')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('status_conversas', function (Blueprint $table) {
            $table->dropColumn('contato_iniciado_em');
        });
    }
};
