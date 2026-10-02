<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\PedidoController;
use App\Http\Controllers\ClienteController;
use App\Http\Controllers\CardapioController;
use App\Http\Controllers\AtendimentoController;

// Rotas do Dashboard
Route::prefix('dashboard')->group(function () {
    Route::get('/kpis', [DashboardController::class, 'getKpis']);
    Route::get('/vendas-grafico', [DashboardController::class, 'getSalesChart']);
    Route::get('/top-produtos', [DashboardController::class, 'getTopProducts']);
    Route::get('/mapa-bairros', [DashboardController::class, 'getDeliveryByNeighborhood']);
    Route::get('/formas-pagamento', [DashboardController::class, 'getPaymentMethods']);
    Route::get('/metricas-ia', [DashboardController::class, 'getAiMetrics']);
});

// Rotas de Pedidos
Route::prefix('pedidos')->group(function () {
    Route::get('/', [PedidoController::class, 'index']);
    Route::post('/', [PedidoController::class, 'store']);
    Route::get('/{id}', [PedidoController::class, 'show']);
    Route::patch('/{id}/status', [PedidoController::class, 'updateStatus']);
});

// Rotas de Clientes
Route::prefix('clientes')->group(function () {
    Route::get('/', [ClienteController::class, 'index']);
    Route::get('/{id}', [ClienteController::class, 'show']);
});

// Rotas do Cardápio (CRUD Completo & Listagem Ativa para o Robô)
Route::prefix('cardapio')->group(function () {
    Route::get('/', [CardapioController::class, 'index']);
    Route::get('/categorias', [CardapioController::class, 'getCategorias']);
    Route::get('/texto', [CardapioController::class, 'getTextoCardapio']);
    Route::post('/produtos', [CardapioController::class, 'store']);
    Route::get('/produtos/{id}', [CardapioController::class, 'show']);
    Route::put('/produtos/{id}', [CardapioController::class, 'update']);
    Route::delete('/produtos/{id}', [CardapioController::class, 'destroy']);
    Route::patch('/produtos/{id}/toggle', [CardapioController::class, 'toggleProdutoStatus']);
});

// Rotas de Atendimentos & Status Conversacional
Route::prefix('atendimentos')->group(function () {
    Route::get('/', [AtendimentoController::class, 'index']);
});

Route::prefix('status-conversa')->group(function () {
    Route::get('/', [AtendimentoController::class, 'getStatusConversas']);
    Route::post('/sync', [AtendimentoController::class, 'syncStatus']);
});

