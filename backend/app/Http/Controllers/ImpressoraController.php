<?php

namespace App\Http\Controllers;

use App\Models\Pedido;
use Illuminate\Http\JsonResponse;

/**
 * Agente de impressão (impressora/agente-impressao.mjs) no computador da cozinha: pega cada pedido novo,
 * imprime e, se a impressora falhar, devolve para tentar de novo.
 */
class ImpressoraController extends Controller
{
    /** Pedidos ainda sem comanda, do mais antigo ao mais novo; só das últimas 12 h (não reimprime o histórico). */
    public function pendentes(): JsonResponse
    {
        $pedidos = Pedido::with(['cliente', 'endereco', 'itens.adicionais'])
            ->whereNull('comanda_impressa_em')
            ->whereIn('status', ['pendente', 'confirmado', 'em_preparo'])
            ->where('created_at', '>=', now()->subHours(12))
            ->orderBy('created_at')
            ->limit(10)
            ->get();

        return response()->json(['pedidos' => $pedidos]);
    }

    /** Marca de forma atômica: só quem marcou primeiro imprime (agente e navegador não duplicam). */
    public function pegar(int $id): JsonResponse
    {
        Pedido::findOrFail($id);
        $marcados = Pedido::whereKey($id)->whereNull('comanda_impressa_em')->update(['comanda_impressa_em' => now()]);

        return response()->json(['primeira' => $marcados === 1]);
    }

    /** A impressora não respondeu: o pedido volta para a fila. */
    public function devolver(int $id): JsonResponse
    {
        Pedido::whereKey($id)->update(['comanda_impressa_em' => null]);

        return response()->json(['ok' => true]);
    }
}
