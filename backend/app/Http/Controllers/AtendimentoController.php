<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Atendimento;

class AtendimentoController extends Controller
{
    public function index(Request $request)
    {
        $query = Atendimento::with(['cliente', 'pedido']);

        if ($request->has('transbordo')) {
            $query->where('transbordo_humano', $request->boolean('transbordo'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $atendimentos = $query->orderBy('created_at', 'DESC')->paginate($request->query('per_page', 15));
        return response()->json($atendimentos);
    }
}
