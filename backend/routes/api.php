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
use App\Http\Controllers\ImpressoraController;
use App\Http\Controllers\PedidoController;
use App\Http\Controllers\PerfilController;
use App\Http\Controllers\SaudeController;
use App\Http\Controllers\UserController;
use App\Http\Middleware\ActiveUser;
use App\Http\Middleware\AdminOnly;
use App\Http\Middleware\BotAccess;
use App\Http\Middleware\ImpressoraAccess;
use App\Http\Middleware\Permissao;
use Illuminate\Support\Facades\Route;

Route::get('/health', HealthController::class);

Route::middleware(BotAccess::class)->group(function () {
    Route::post('/pedidos', [PedidoController::class, 'store']);
    Route::get('/pedidos/consulta/bot', [PedidoController::class, 'consultaBot']);
    Route::post('/bot/pedidos/total', [PedidoController::class, 'totalParaBot']);
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
Route::middleware(ImpressoraAccess::class)->prefix('impressora')->group(function () {
    Route::get('/pendentes', [ImpressoraController::class, 'pendentes']);
    Route::post('/pedidos/{id}/comanda', [ImpressoraController::class, 'pegar'])->whereNumber('id');
    Route::delete('/pedidos/{id}/comanda', [ImpressoraController::class, 'devolver'])->whereNumber('id');
});
$pode = fn (string $tela, string $acao): string => Permissao::class.":{$tela},{$acao}";

Route::middleware('web')->group(function () use ($pode) {
    Route::post('/auth/logout', [AuthController::class, 'logout'])->middleware('auth');
    Route::get('/auth/csrf', [AuthController::class, 'csrf']);
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:20,1');
    Route::middleware(['auth', ActiveUser::class])->group(function () use ($pode) {
        Route::get('/auth/me', [AuthController::class, 'me']);

        // Cada rota confere a permissão do perfil (tela, ação). Administrador tem todas.
        Route::get('/usuarios', [UserController::class, 'index'])->middleware($pode('usuarios', 'ver'));
        Route::post('/usuarios', [UserController::class, 'store'])->middleware([$pode('usuarios', 'criar'), 'throttle:30,1']);
        Route::put('/usuarios/{id}', [UserController::class, 'update'])->whereNumber('id')->middleware([$pode('usuarios', 'editar'), 'throttle:30,1']);
        Route::delete('/usuarios/{id}', [UserController::class, 'destroy'])->whereNumber('id')->middleware($pode('usuarios', 'excluir'));

        // Perfis: quem cadastra usuário precisa da lista; criar, editar e excluir perfil é só do administrador.
        Route::get('/perfis', [PerfilController::class, 'index'])->middleware($pode('usuarios', 'ver'));
        Route::middleware(AdminOnly::class)->group(function () {
            Route::post('/perfis', [PerfilController::class, 'store']);
            Route::put('/perfis/{id}', [PerfilController::class, 'update'])->whereNumber('id');
            Route::delete('/perfis/{id}', [PerfilController::class, 'destroy'])->whereNumber('id');
        });

        // Usados pelo cabeçalho e pelo menu em qualquer tela: abertos a todos os perfis.
        Route::get('/horarios-atendimento', [HorarioAtendimentoController::class, 'index']);
        Route::get('/sistema/saude', SaudeController::class);
        Route::get('/sistema/saude/{codigo}', [SaudeController::class, 'detalhes']);
        // Dispensar mensagens de um aviso conta como "editar" em Atendimentos.
        Route::delete('/sistema/saude/{codigo}/{id?}', [SaudeController::class, 'dispensar'])->whereNumber('id')->middleware($pode('atendimentos', 'editar'));
        Route::get('/dashboard/kpis', [DashboardController::class, 'getKpis']);
        Route::get('/status-pedidos', [PedidoController::class, 'getStatusCatalog']);

        Route::put('/horarios-atendimento/{dia}', [HorarioAtendimentoController::class, 'update'])->where('dia', '[1-7]')->middleware($pode('horarios', 'editar'));
        Route::get('/empresa', [EmpresaController::class, 'show'])->middleware($pode('empresa', 'ver'));
        Route::put('/empresa', [EmpresaController::class, 'update'])->middleware($pode('empresa', 'editar'));

        Route::prefix('dashboard')->middleware($pode('dashboard', 'ver'))->group(function () {
            Route::get('/analises', [DashboardController::class, 'getAnalises']);
            Route::get('/vendas-grafico', [DashboardController::class, 'getSalesChart']);
            Route::get('/top-produtos', [DashboardController::class, 'getTopProducts']);
            Route::get('/mapa-bairros', [DashboardController::class, 'getDeliveryByNeighborhood']);
            Route::get('/formas-pagamento', [DashboardController::class, 'getPaymentMethods']);
            Route::get('/metricas-ia', [DashboardController::class, 'getAiMetrics']);
        });

        // Pedidos: mudar status, cancelar e imprimir comanda contam como "editar".
        Route::prefix('pedidos')->group(function () use ($pode) {
            Route::get('/', [PedidoController::class, 'index'])->middleware($pode('pedidos', 'ver'));
            Route::get('/{id}', [PedidoController::class, 'show'])->middleware($pode('pedidos', 'ver'));
            Route::patch('/{id}/status', [PedidoController::class, 'updateStatus'])->middleware($pode('pedidos', 'editar'));
            Route::post('/{id}/comanda', [PedidoController::class, 'registrarComanda'])->whereNumber('id')->middleware($pode('pedidos', 'editar'));
            Route::delete('/{id}', [PedidoController::class, 'destroy'])->whereNumber('id')->middleware($pode('pedidos', 'excluir'));
        });

        Route::prefix('clientes')->group(function () use ($pode) {
            Route::get('/', [ClienteController::class, 'index'])->middleware($pode('clientes', 'ver'));
            Route::get('/{id}', [ClienteController::class, 'show'])->middleware($pode('clientes', 'ver'));
            Route::delete('/{id}', [ClienteController::class, 'anonimizar'])->whereNumber('id')->middleware($pode('clientes', 'excluir'));
        });

        // Cardápio: pausar/ativar prato conta como "editar".
        Route::prefix('cardapio')->group(function () use ($pode) {
            Route::get('/', [CardapioController::class, 'index'])->middleware($pode('cardapio', 'ver'));
            Route::get('/categorias', [CardapioController::class, 'getCategorias'])->middleware($pode('cardapio', 'ver'));
            Route::get('/produtos/{id}', [CardapioController::class, 'show'])->middleware($pode('cardapio', 'ver'));
            Route::post('/produtos', [CardapioController::class, 'store'])->middleware($pode('cardapio', 'criar'));
            Route::put('/produtos/{id}', [CardapioController::class, 'update'])->middleware($pode('cardapio', 'editar'));
            Route::patch('/produtos/{id}/toggle', [CardapioController::class, 'toggleProdutoStatus'])->middleware($pode('cardapio', 'editar'));
            Route::delete('/produtos/{id}', [CardapioController::class, 'destroy'])->middleware($pode('cardapio', 'excluir'));
        });

        // Atendimentos: responder, pausar o bot, saudar e dispensar aviso contam como "editar".
        Route::get('/atendimentos', [AtendimentoController::class, 'index'])->middleware($pode('atendimentos', 'ver'));
        Route::get('/conversas/sem-resposta', [ConversaController::class, 'semResposta'])->middleware($pode('atendimentos', 'ver'));
        Route::delete('/conversas/{telefone}/sem-resposta', [ConversaController::class, 'dispensarSemResposta'])->middleware($pode('atendimentos', 'editar'));
        Route::get('/conversas/{telefone}/mensagens', [ConversaController::class, 'mensagens'])->middleware($pode('atendimentos', 'ver'));
        Route::post('/conversas/{telefone}/mensagens', [ConversaController::class, 'enviar'])->middleware([$pode('atendimentos', 'editar'), 'throttle:60,1']);
        Route::post('/conversas/{telefone}/pausa', [ConversaController::class, 'alterarPausa'])->middleware($pode('atendimentos', 'editar'));
        Route::prefix('status-conversa')->group(function () use ($pode) {
            Route::get('/', [AtendimentoController::class, 'getStatusConversas'])->middleware($pode('atendimentos', 'ver'));
            Route::post('/{id}/contato', [AtendimentoController::class, 'iniciarContato'])->whereNumber('id')->middleware($pode('atendimentos', 'editar'));
            Route::delete('/{id}/alerta', [AtendimentoController::class, 'excluirAlerta'])->whereNumber('id')->middleware($pode('atendimentos', 'excluir'));
            Route::delete('/{id}', [AtendimentoController::class, 'excluirConversa'])->whereNumber('id')->middleware($pode('atendimentos', 'excluir'));
        });
    });
});
