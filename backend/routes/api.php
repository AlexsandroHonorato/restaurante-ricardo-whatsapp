<?php

use App\Http\Controllers\AtendimentoController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BotMensagemController;
use App\Http\Controllers\CardapioController;
use App\Http\Controllers\ClienteController;
use App\Http\Controllers\ConversaController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\EmpresaController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\HorarioAtendimentoController;
use App\Http\Controllers\PedidoController;
use App\Http\Controllers\SaudeController;
use App\Http\Controllers\UserController;
use App\Http\Middleware\ActiveUser;
use App\Http\Middleware\AdminOnly;
use App\Http\Middleware\BotAccess;
use Illuminate\Support\Facades\Route;

Route::get('/health', HealthController::class);

Route::middleware(BotAccess::class)->group(function () {
    Route::post('/pedidos', [PedidoController::class, 'store']);
    Route::get('/pedidos/consulta/bot', [PedidoController::class, 'consultaBot']);
    Route::get('/cardapio/texto', [CardapioController::class, 'getTextoCardapio']);
    Route::post('/status-conversa/sync', [AtendimentoController::class, 'syncStatus']);
    Route::get('/bot/horarios-atendimento', [HorarioAtendimentoController::class, 'index']);
    Route::post('/bot/mensagens/entrada', [BotMensagemController::class, 'registrarEntrada']);
    Route::post('/bot/mensagens/saida', [BotMensagemController::class, 'criarSaida']);
    Route::get('/bot/mensagens/pendentes', [BotMensagemController::class, 'pendentes']);
    Route::patch('/bot/mensagens/{id}', [BotMensagemController::class, 'atualizar'])->whereNumber('id');
    Route::get('/bot/conversas/{telefone}', [BotMensagemController::class, 'conversa']);
    Route::get('/bot/empresa', [EmpresaController::class, 'paraBot']);
    Route::get('/bot/conversas/{telefone}/pausa', [ConversaController::class, 'pausaParaBot']);
});
Route::middleware('web')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout'])->middleware('auth');
    Route::get('/auth/csrf', [AuthController::class, 'csrf']);
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:20,1');
    Route::middleware(['auth', ActiveUser::class])->group(function () {
        Route::get('/auth/me', [AuthController::class, 'me']);

        Route::get('/usuarios', [UserController::class, 'index']);
        Route::post('/usuarios', [UserController::class, 'store'])->middleware('throttle:30,1');
        Route::put('/usuarios/{id}', [UserController::class, 'update'])->whereNumber('id')->middleware('throttle:30,1');
        Route::delete('/usuarios/{id}', [UserController::class, 'destroy'])->whereNumber('id')->middleware(AdminOnly::class);
        Route::get('/horarios-atendimento', [HorarioAtendimentoController::class, 'index']);
        Route::get('/sistema/saude', SaudeController::class);
        Route::get('/empresa', [EmpresaController::class, 'show']);
        Route::get('/conversas/{telefone}/mensagens', [ConversaController::class, 'mensagens']);
        Route::post('/conversas/{telefone}/mensagens', [ConversaController::class, 'enviar'])->middleware('throttle:60,1');
        Route::post('/conversas/{telefone}/pausa', [ConversaController::class, 'alterarPausa']);
        Route::put('/empresa', [EmpresaController::class, 'update'])->middleware(AdminOnly::class);
        // Rotas do Dashboard
        Route::prefix('dashboard')->group(function () {
            // KPIs alimentam os contadores do menu e a tela de Pedidos (todos os perfis); o resto é do Dashboard, só administrador.
            Route::get('/kpis', [DashboardController::class, 'getKpis']);
            Route::middleware(AdminOnly::class)->group(function () {
                Route::get('/analises', [DashboardController::class, 'getAnalises']);
                Route::get('/vendas-grafico', [DashboardController::class, 'getSalesChart']);
                Route::get('/top-produtos', [DashboardController::class, 'getTopProducts']);
                Route::get('/mapa-bairros', [DashboardController::class, 'getDeliveryByNeighborhood']);
                Route::get('/formas-pagamento', [DashboardController::class, 'getPaymentMethods']);
                Route::get('/metricas-ia', [DashboardController::class, 'getAiMetrics']);
            });
        });

        // Rotas de Pedidos
        Route::prefix('pedidos')->group(function () {
            Route::get('/', [PedidoController::class, 'index']);

            Route::get('/{id}', [PedidoController::class, 'show']);
            Route::patch('/{id}/status', [PedidoController::class, 'updateStatus']);
            Route::post('/{id}/comanda', [PedidoController::class, 'registrarComanda'])->whereNumber('id');
        });
        Route::get('/status-pedidos', [PedidoController::class, 'getStatusCatalog']);

        // Rotas de Clientes
        Route::prefix('clientes')->group(function () {
            Route::get('/', [ClienteController::class, 'index']);
            Route::get('/{id}', [ClienteController::class, 'show']);
            Route::delete('/{id}', [ClienteController::class, 'anonimizar'])->whereNumber('id')->middleware(AdminOnly::class);
        });

        // Rotas do Cardápio (CRUD Completo & Listagem Ativa para o Robô)
        Route::prefix('cardapio')->group(function () {
            Route::get('/', [CardapioController::class, 'index']);
            Route::get('/categorias', [CardapioController::class, 'getCategorias']);

            Route::post('/produtos', [CardapioController::class, 'store'])->middleware(AdminOnly::class);
            Route::get('/produtos/{id}', [CardapioController::class, 'show']);
            Route::put('/produtos/{id}', [CardapioController::class, 'update'])->middleware(AdminOnly::class);
            Route::delete('/produtos/{id}', [CardapioController::class, 'destroy'])->middleware(AdminOnly::class);
            Route::patch('/produtos/{id}/toggle', [CardapioController::class, 'toggleProdutoStatus'])->middleware(AdminOnly::class);
        });

        // Rotas de Atendimentos & Status Conversacional
        Route::prefix('atendimentos')->group(function () {
            Route::get('/', [AtendimentoController::class, 'index']);
        });

        Route::prefix('status-conversa')->group(function () {
            Route::get('/', [AtendimentoController::class, 'getStatusConversas']);
            Route::post('/{id}/contato', [AtendimentoController::class, 'iniciarContato'])->whereNumber('id');

        });

        Route::put('/horarios-atendimento/{dia}', [HorarioAtendimentoController::class, 'update'])->where('dia', '[1-7]')->middleware(AdminOnly::class);

    });
});
