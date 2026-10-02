<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Cliente;

class ClienteController extends Controller
{
    public function index(Request $request)
    {
        $query = Cliente::with('enderecos');

        if ($request->filled('busca')) {
            $busca = $request->busca;
            $query->where(function($q) use ($busca) {
                $q->where('nome', 'like', "%{$busca}%")
                  ->orWhere('telefone', 'like', "%{$busca}%");
            });
        }

        $clientes = $query->orderBy('total_gasto', 'DESC')->paginate($request->query('per_page', 15));
        return response()->json($clientes);
    }

    public function show($id)
    {
        $cliente = Cliente::with(['enderecos', 'pedidos.itens', 'atendimentos'])->findOrFail($id);
        return response()->json($cliente);
    }
}
