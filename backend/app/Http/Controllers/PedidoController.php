<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Pedido;
use App\Models\HistoricoStatusPedido;
use Carbon\Carbon;

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

        if ($request->filled('busca')) {
            $busca = $request->busca;
            $query->where(function($q) use ($busca) {
                $q->where('codigo_pedido', 'like', "%{$busca}%")
                  ->orWhereHas('cliente', function($qc) use ($busca) {
                      $qc->where('nome', 'like', "%{$busca}%")
                         ->orWhere('telefone', 'like', "%{$busca}%");
                  });
            });
        }

        $pedidos = $query->orderBy('created_at', 'DESC')->paginate($request->query('per_page', 15));

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
     * Atualiza o status do pedido (ex: de 'em_preparo' para 'saiu_para_entrega')
     */
    public function updateStatus(Request $request, $id)
    {
        $request->validate([
            'status' => 'required|in:pendente,confirmado,em_preparo,saiu_para_entrega,entregue,cancelado',
            'alterado_por' => 'nullable|string',
            'observacao' => 'nullable|string',
        ]);

        $pedido = Pedido::findOrFail($id);
        $statusAnterior = $pedido->status;
        $statusNovo = $request->status;

        $pedido->status = $statusNovo;
        if ($statusNovo === 'em_preparo' && !$pedido->preparado_em) {
            $pedido->preparado_em = Carbon::now();
        } elseif ($statusNovo === 'saiu_para_entrega' && !$pedido->saiu_entrega_em) {
            $pedido->saiu_entrega_em = Carbon::now();
        } elseif ($statusNovo === 'entregue' && !$pedido->entregue_em) {
            $pedido->entregue_em = Carbon::now();
        } elseif ($statusNovo === 'cancelado' && !$pedido->cancelado_em) {
            $pedido->cancelado_em = Carbon::now();
        }
        $pedido->save();

        HistoricoStatusPedido::create([
            'pedido_id' => $pedido->id,
            'status_anterior' => $statusAnterior,
            'status_novo' => $statusNovo,
            'alterado_por' => $request->input('alterado_por', 'painel_admin'),
            'observacao' => $request->input('observacao'),
        ]);

        return response()->json([
            'message' => 'Status atualizado com sucesso',
            'pedido' => $pedido->fresh(['cliente', 'endereco', 'itens', 'historicoStatus'])
        ]);
    }
}
