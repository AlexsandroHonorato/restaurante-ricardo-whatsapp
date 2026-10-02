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
        // 1. Clientes
        Schema::create('clientes', function (Blueprint $table) {
            $table->id();
            $table->string('telefone', 30)->unique()->index();
            $table->string('nome', 150)->nullable()->index();
            $table->timestamp('primeiro_contato_em')->useCurrent();
            $table->timestamp('ultimo_contato_em')->useCurrent()->useCurrentOnUpdate();
            $table->unsignedInteger('total_pedidos')->default(0)->index();
            $table->decimal('total_gasto', 10, 2)->default(0.00)->index();
            $table->boolean('ativo')->default(true);
            $table->timestamps();
        });

        // 2. Endereços
        Schema::create('enderecos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cliente_id')->constrained('clientes')->onDelete('cascade');
            $table->string('logradouro', 255);
            $table->string('numero', 30);
            $table->string('bairro', 100)->index();
            $table->string('complemento', 100)->nullable();
            $table->string('ponto_referencia', 255)->nullable();
            $table->string('cep', 20)->nullable();
            $table->string('cidade', 100)->default('Caraguatatuba');
            $table->string('estado', 2)->default('SP');
            $table->boolean('padrao')->default(true);
            $table->timestamps();
        });

        // 3. Categorias
        Schema::create('categorias', function (Blueprint $table) {
            $table->id();
            $table->string('nome', 100);
            $table->string('slug', 100)->unique();
            $table->string('descricao', 255)->nullable();
            $table->integer('ordem_exibicao')->default(0);
            $table->boolean('ativo')->default(true);
            $table->timestamps();
        });

        // 4. Produtos (Pratos, Porções, Adicionais, Bebidas)
        Schema::create('produtos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('categoria_id')->constrained('categorias')->onDelete('restrict');
            $table->enum('tipo', ['prato_executivo', 'prato_do_dia', 'porcao', 'adicional', 'bebida', 'cerveja'])->index();
            $table->string('nome', 150);
            $table->text('descricao')->nullable();
            $table->string('dias_disponiveis', 100)->default('todos');
            $table->boolean('ativo')->default(true)->index();
            $table->timestamps();
        });

        // 5. Variações de Produto (Tamanhos e Preços)
        Schema::create('produto_variacoes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('produto_id')->constrained('produtos')->onDelete('cascade');
            $table->string('tamanho', 50); // ex: Infantil, Médio, Grande, 2L, Lata
            $table->decimal('preco', 10, 2);
            $table->string('codigo_sku', 50)->nullable();
            $table->boolean('ativo')->default(true);
            $table->timestamps();
        });

        // 6. Pedidos
        Schema::create('pedidos', function (Blueprint $table) {
            $table->id();
            $table->string('codigo_pedido', 30)->unique()->index();
            $table->foreignId('cliente_id')->constrained('clientes')->onDelete('restrict');
            $table->foreignId('endereco_id')->nullable()->constrained('enderecos')->onDelete('set null');
            $table->enum('status', ['pendente', 'confirmado', 'em_preparo', 'saiu_para_entrega', 'entregue', 'cancelado'])->default('pendente')->index();
            $table->enum('forma_pagamento', ['dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'outro'])->index();
            $table->decimal('valor_subtotal', 10, 2)->default(0.00);
            $table->decimal('taxa_entrega', 10, 2)->default(0.00);
            $table->decimal('valor_desconto', 10, 2)->default(0.00);
            $table->decimal('valor_total', 10, 2);
            $table->decimal('troco_para', 10, 2)->nullable();
            $table->decimal('valor_troco', 10, 2)->nullable();
            $table->integer('tempo_estimado_min')->default(50);
            $table->text('observacoes')->nullable();
            $table->string('origem', 50)->default('whatsapp_ia');
            $table->timestamp('preparado_em')->nullable();
            $table->timestamp('saiu_entrega_em')->nullable();
            $table->timestamp('entregue_em')->nullable();
            $table->timestamp('cancelado_em')->nullable();
            $table->timestamps();
        });

        // 7. Itens do Pedido
        Schema::create('pedido_itens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pedido_id')->constrained('pedidos')->onDelete('cascade');
            $table->foreignId('produto_id')->nullable()->constrained('produtos')->onDelete('set null');
            $table->foreignId('variacao_id')->nullable()->constrained('produto_variacoes')->onDelete('set null');
            $table->string('nome_snapshot', 150);
            $table->string('tamanho_snapshot', 50);
            $table->unsignedInteger('quantidade')->default(1);
            $table->decimal('preco_unitario', 10, 2);
            $table->decimal('subtotal', 10, 2);
            $table->string('observacao', 255)->nullable();
            $table->timestamps();
        });

        // 8. Adicionais dos Itens do Pedido
        Schema::create('pedido_item_adicionais', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pedido_item_id')->constrained('pedido_itens')->onDelete('cascade');
            $table->foreignId('produto_id')->nullable()->constrained('produtos')->onDelete('set null');
            $table->string('nome_snapshot', 150);
            $table->unsignedInteger('quantidade')->default(1);
            $table->decimal('preco_unitario', 10, 2);
            $table->decimal('subtotal', 10, 2);
            $table->timestamps();
        });

        // 9. Atendimentos (Métricas de IA e Conversão)
        Schema::create('atendimentos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cliente_id')->constrained('clientes')->onDelete('cascade');
            $table->foreignId('pedido_id')->nullable()->constrained('pedidos')->onDelete('set null');
            $table->timestamp('inicio_em')->useCurrent()->index();
            $table->timestamp('fim_em')->nullable();
            $table->unsignedInteger('duracao_segundos')->nullable();
            $table->enum('status', ['em_andamento', 'finalizado_com_pedido', 'finalizado_sem_pedido', 'transbordo_humano', 'abandonado'])->default('em_andamento')->index();
            $table->unsignedInteger('total_mensagens_cliente')->default(0);
            $table->unsignedInteger('total_mensagens_bot')->default(0);
            $table->boolean('transbordo_humano')->default(false)->index();
            $table->string('motivo_transbordo', 255)->nullable();
            $table->unsignedInteger('tokens_estimados')->default(0);
            $table->string('canal', 50)->default('whatsapp');
            $table->timestamps();
        });

        // 10. Histórico de Status dos Pedidos (Lead Time)
        Schema::create('historico_status_pedidos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pedido_id')->constrained('pedidos')->onDelete('cascade');
            $table->string('status_anterior', 50)->nullable();
            $table->string('status_novo', 50);
            $table->timestamp('alterado_em')->useCurrent()->index();
            $table->string('alterado_por', 100)->default('ia_bot');
            $table->string('observacao', 255)->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('historico_status_pedidos');
        Schema::dropIfExists('atendimentos');
        Schema::dropIfExists('pedido_item_adicionais');
        Schema::dropIfExists('pedido_itens');
        Schema::dropIfExists('pedidos');
        Schema::dropIfExists('produto_variacoes');
        Schema::dropIfExists('produtos');
        Schema::dropIfExists('categorias');
        Schema::dropIfExists('enderecos');
        Schema::dropIfExists('clientes');
    }
};
