<?php

namespace App\Http\Controllers;

use App\Models\Cliente;
use App\Support\DadosPessoais;
use Illuminate\Http\Request;

class ClienteController extends Controller
{
    public function index(Request $request)
    {
        $query = Cliente::with('enderecos');

        if ($request->filled('busca')) {
            $busca = $request->busca;
            $query->where(function ($q) use ($busca) {
                $q->where('nome', 'like', "%{$busca}%")
                    ->orWhere('telefone', 'like', "%{$busca}%");
            });
        }

        $clientes = $query->orderBy('total_gasto', 'DESC')->paginate(max(1, min(100, (int) $request->query('per_page', 15))));

        return response()->json($clientes);
    }

    public function show($id)
    {
        $cliente = Cliente::with(['enderecos', 'pedidos.itens', 'atendimentos'])->findOrFail($id);

        return response()->json($cliente);
    }

    /** LGPD: exclusão a pedido do titular (admin). Pedidos continuam no faturamento, sem identificar a pessoa. */
    public function anonimizar(int $id)
    {
        DadosPessoais::anonimizar(Cliente::findOrFail($id));

        return response()->json(['message' => 'Dados pessoais do cliente removidos.']);
    }
}
