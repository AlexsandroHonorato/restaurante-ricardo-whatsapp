<?php

namespace App\Http\Controllers;

use App\Models\HistoricoStatusPedido;
use App\Models\Pedido;
use App\Models\StatusPedido;
use App\PedidoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class PedidoController extends Controller
{
    /**
     * Listagem de pedidos com filtros de status e busca
     */
    public function index(Request $request)
    {
        $query = Pedido::with(['cliente', 'endereco', 'itens.adicionais']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->boolean('sem_comanda')) {
            $query->whereNull('comanda_impressa_em')->whereIn('status', ['pendente', 'confirmado', 'em_preparo']);
        }

        if ($request->filled('busca')) {
            $busca = $request->busca;
            $query->where(function ($q) use ($busca) {
                $q->where('codigo_pedido', 'like', "%{$busca}%")
                    ->orWhereHas('cliente', function ($qc) use ($busca) {
                        $qc->where('nome', 'like', "%{$busca}%")
                            ->orWhere('telefone', 'like', "%{$busca}%");
                    });
            });
        }

        $pedidos = $query->orderBy('created_at', 'DESC')->paginate(max(1, min(100, (int) $request->query('per_page', 15))));

        return response()->json($pedidos);
    }

    /**
     * Exibe um pedido específico com todo o histórico
     */
    public function show($id)
    {
        $pedido = Pedido::with(['cliente', 'endereco', 'itens.adicionais', 'historicoStatus', 'atendimento'])->findOrFail($id);

        return response()->json($pedido);
    }

    /**
     * Registra a impressão da comanda. "primeira" só é true para quem marcou primeiro: a impressão
     * automática imprime apenas nesse caso, então dois aparelhos na cozinha não imprimem em dobro.
     */
    public function registrarComanda($id): JsonResponse
    {
        Pedido::findOrFail($id);
        $marcados = Pedido::whereKey($id)->whereNull('comanda_impressa_em')->update(['comanda_impressa_em' => now()]);

        return response()->json(['primeira' => $marcados === 1]);
    }

    /**
     * Atualiza o status do pedido (ex: de 'em_preparo' para 'saiu_para_entrega')
     */
    public function updateStatus(Request $request, $id)
    {
        $request->validate([
            'status' => 'required|in:pendente,confirmado,em_preparo,saiu_para_entrega,entregue,cancelado',
            'observacao' => 'nullable|string|max:1000',
            'motivo_cancelamento' => 'nullable|string|max:255',
        ]);

        [$pedido, $alterado] = DB::transaction(function () use ($request, $id) {
            $pedido = Pedido::whereKey($id)->lockForUpdate()->firstOrFail();
            $anterior = $pedido->status;
            $novo = $request->status;
            if ($anterior === $novo) {
                return [$pedido, false];
            }
            $transicoes = [
                'pendente' => ['confirmado', 'em_preparo', 'cancelado'],
                'confirmado' => ['em_preparo', 'cancelado'],
                'em_preparo' => ['saiu_para_entrega', 'cancelado'],
                'saiu_para_entrega' => ['entregue', 'cancelado'],
                'entregue' => [], 'cancelado' => [],
            ];
            if (! in_array($novo, $transicoes[$anterior] ?? [], true)) {
                throw ValidationException::withMessages(['status' => 'Transição de status inválida.']);
            }
            $pedido->status = $novo;
            if ($novo === 'cancelado') {
                $pedido->motivo_cancelamento = $request->input('motivo_cancelamento') ?: $request->input('observacao');
            }
            $campo = ['em_preparo' => 'preparado_em', 'saiu_para_entrega' => 'saiu_entrega_em', 'entregue' => 'entregue_em', 'cancelado' => 'cancelado_em'][$novo] ?? null;
            if ($campo && ! $pedido->$campo) {
                $pedido->$campo = now();
            }
            $pedido->save();
            HistoricoStatusPedido::create([
                'pedido_id' => $pedido->id, 'status_anterior' => $anterior, 'status_novo' => $novo,
                // Autor vem da sessão: o cliente HTTP não pode atribuir a mudança a outra pessoa.
                'alterado_por' => $request->user()->email, 'observacao' => $request->input('observacao'),
            ]);

            return [$pedido, true];
        });
        $statusNovo = $pedido->status;
        // Dispara notificação automática para o WhatsApp do cliente se saiu para entrega com idempotência
        $mensagemNotificacao = null;
        $notificacaoEnviada = false;
        $erroNotificacao = null;
        if ($statusNovo === 'saiu_para_entrega' && $pedido->cliente?->telefone) {
            $mensagem = "🛵💨 Temos uma ótima notícia! O seu pedido {$pedido->codigo_pedido} acabou de sair para entrega e está a caminho! Em breve nosso motoboy chegará ao seu endereço.";
            try {
                $resposta = Http::timeout(5)
                    ->withToken(config('services.bot.token') ?? '')
                    ->post(config('services.bot.url').'/api/notificar', [
                        'para' => $pedido->cliente->telefone, 'texto' => $mensagem,
                        'idempotency_key' => "despacho_{$pedido->id}_{$pedido->codigo_pedido}",
                    ])->throw();
                $notificacaoEnviada = $resposta->json('ok') === true;
                if ($notificacaoEnviada) {
                    $mensagemNotificacao = $mensagem;
                } else {
                    $erroNotificacao = $resposta->json('pendente') === true
                        ? 'Notificação na fila: o WhatsApp não respondeu e ela será reenviada automaticamente.'
                        : 'O serviço não confirmou o envio.';
                }
            } catch (\Throwable $e) {
                Log::warning('Falha na notificação de despacho', ['pedido_id' => $pedido->id, 'erro' => $e->getMessage()]);
                $erroNotificacao = 'Pedido despachado; não foi possível confirmar a notificação.';
            }
        }

        return response()->json([
            'message' => 'Status atualizado com sucesso',
            'notificacao_whatsapp' => $mensagemNotificacao,
            'notificacao_enviada' => $notificacaoEnviada,
            'erro_notificacao' => $erroNotificacao,
            'status_alterado' => $alterado,
            'pedido' => $pedido->fresh(['cliente', 'endereco', 'itens', 'historicoStatus']),
        ]);
    }

    /**
     * Registra novo pedido vindo do WhatsApp / Robô ou API
     */
    public function store(Request $request)
    {
        $dados = $request->validate([
            'codigo_pedido' => 'nullable|string|max:30',
            'chave_idempotencia' => 'nullable|string|max:150',
            'telefone' => ['required', 'regex:/^\d{10,15}$/'],
            'nome' => 'required|string|max:150',
            'endereco' => 'required|string|max:255',
            'bairro' => 'nullable|string|max:100',
            'formaPagamento' => 'required|string|max:50',
            'trocoPara' => 'nullable',
            'taxa_entrega' => 'nullable',
            'itens' => 'required|array|min:1|max:100',
            'itens.*.variacao_id' => 'required|integer|min:1',
            'itens.*.quantidade' => 'required|integer|min:1|max:100',
            'observacoes' => 'nullable|string|max:2000',
        ]);
        $pedido = app(PedidoService::class)->registrar($dados);

        return response()->json([
            'message' => 'Pedido registrado com sucesso',
            'pedido' => $pedido->load(['cliente', 'endereco', 'itens']),
        ], $pedido->wasRecentlyCreated ? 201 : 200);
    }

    public function consultaBot(Request $request): JsonResponse
    {
        $dados = $request->validate([
            'telefone' => ['required', 'regex:/^\d{10,15}$/'],
            'codigo_pedido' => 'nullable|string|max:30',
        ]);
        $query = Pedido::with(['cliente', 'endereco', 'itens'])->whereHas('cliente', fn ($q) => $q->where('telefone', $dados['telefone']));
        if (! empty($dados['codigo_pedido'])) {
            $query->where('codigo_pedido', $dados['codigo_pedido']);
        }
        $pedido = $query->latest('id')->first();

        return response()->json(['pedido' => $pedido], $pedido ? 200 : 404);
    }

    /**
     * Retorna a lista de status de pedidos cadastrados no sistema
     */
    public function getStatusCatalog()
    {
        $status = StatusPedido::where('ativo', true)
            ->orderBy('ordem', 'ASC')
            ->get();

        return response()->json($status);
    }
}
