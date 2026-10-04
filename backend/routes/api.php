<?php

use App\Http\Controllers\AtendimentoController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CardapioController;
use App\Http\Controllers\ClienteController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\HorarioAtendimentoController;
use App\Http\Controllers\PedidoController;
use App\Http\Controllers\UserController;
use App\Http\Middleware\ActiveUser;
use App\Http\Middleware\BotAccess;
use Illuminate\Support\Facades\Route;

Route::middleware(BotAccess::class)->group(function () {
    Route::post('/pedidos', [PedidoController::class, 'store']);
    Route::get('/pedidos/consulta/bot', [PedidoController::class, 'consultaBot']);
    Route::get('/cardapio/texto', [CardapioController::class, 'getTextoCardapio']);
    Route::post('/status-conversa/sync', [AtendimentoController::class, 'syncStatus']);
    Route::get('/bot/horarios-atendimento', [HorarioAtendimentoController::class, 'index']);
});
Route::middleware('web')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout'])->middleware('auth');
    Route::get('/auth/csrf', [AuthController::class, 'csrf']);
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:20,1');
    Route::middleware(['auth', ActiveUser::class])->group(function () {
        Route::get('/auth/me', [AuthController::class, 'me']);

        Route::get('/usuarios', [UserController::class, 'index']);
        Route::post('/usuarios', [UserController::class, 'store'])->middleware('throttle:30,1');
        Route::get('/horarios-atendimento', [HorarioAtendimentoController::class, 'index']);
        // Rotas do Dashboard
        Route::prefix('dashboard')->group(function () {
            Route::get('/analises', [DashboardController::class, 'getAnalises']);
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

            Route::get('/{id}', [PedidoController::class, 'show']);
            Route::patch('/{id}/status', [PedidoController::class, 'updateStatus']);
        });
        Route::get('/status-pedidos', [PedidoController::class, 'getStatusCatalog']);

        // Rotas de Clientes
        Route::prefix('clientes')->group(function () {
            Route::get('/', [ClienteController::class, 'index']);
            Route::get('/{id}', [ClienteController::class, 'show']);
        });

        // Rotas do Cardápio (CRUD Completo & Listagem Ativa para o Robô)
        Route::prefix('cardapio')->group(function () {
            Route::get('/', [CardapioController::class, 'index']);
            Route::get('/categorias', [CardapioController::class, 'getCategorias']);

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
            Route::post('/{id}/contato', [AtendimentoController::class, 'iniciarContato'])->whereNumber('id');

        });

        Route::put('/horarios-atendimento/{dia}', [HorarioAtendimentoController::class, 'update'])->where('dia', '[1-7]');

    });
});
