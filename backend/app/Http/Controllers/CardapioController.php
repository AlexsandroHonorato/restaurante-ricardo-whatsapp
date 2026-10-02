<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Categoria;
use App\Models\Produto;

class CardapioController extends Controller
{
    public function index()
    {
        $cardapio = Categoria::with(['produtos.variacoes'])
            ->orderBy('ordem_exibicao', 'ASC')
            ->get();

        return response()->json($cardapio);
    }

    public function toggleProdutoStatus($id)
    {
        $produto = Produto::findOrFail($id);
        $produto->ativo = !$produto->ativo;
        $produto->save();

        return response()->json([
            'message' => 'Status do produto alterado com sucesso',
            'produto' => $produto
        ]);
    }
}
