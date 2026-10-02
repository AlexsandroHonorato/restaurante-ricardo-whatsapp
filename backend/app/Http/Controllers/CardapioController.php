<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Categoria;
use App\Models\Produto;
use App\Models\ProdutoVariacao;
use Illuminate\Support\Facades\DB;

class CardapioController extends Controller
{
    /**
     * Lista o cardápio completo com categorias, produtos e variações de preço
     */
    public function index(Request $request)
    {
        $query = Categoria::with(['produtos' => function ($q) use ($request) {
            if ($request->boolean('somente_ativos')) {
                $q->where('ativo', true);
            }
            $q->with(['variacoes' => function ($qv) use ($request) {
                if ($request->boolean('somente_ativos')) {
                    $qv->where('ativo', true);
                }
            }]);
        }])
        ->where('ativo', true)
        ->orderBy('ordem_exibicao', 'ASC');

        return response()->json($query->get());
    }

    /**
     * Retorna a lista de categorias para o formulário de cadastro/edição
     */
    public function getCategorias()
    {
        return response()->json(Categoria::where('ativo', true)->orderBy('ordem_exibicao')->get());
    }

    /**
     * Retorna o texto formatado do cardápio ativo diretamente do banco de dados para a IA / WhatsApp
     */
    public function getTextoCardapio()
    {
        $categorias = Categoria::with(['produtos' => function ($q) {
            $q->where('ativo', true)->with(['variacoes' => function ($qv) {
                $qv->where('ativo', true);
            }]);
        }])
        ->where('ativo', true)
        ->orderBy('ordem_exibicao', 'ASC')
        ->get();

        $linhas = [];
        foreach ($categorias as $cat) {
            if ($cat->produtos->isEmpty()) continue;

            $linhas[] = "\n### " . mb_strtoupper($cat->nome, 'UTF-8');
            if ($cat->descricao) {
                $linhas[] = "_{$cat->descricao}_";
            }

            foreach ($cat->produtos as $prod) {
                $variacoesStr = [];
                foreach ($prod->variacoes as $v) {
                    $precoFmt = 'R$ ' . number_format((float) $v->preco, 2, ',', '.');
                    $variacoesStr[] = "{$v->tamanho}: {$precoFmt}";
                }
                $varTexto = !empty($variacoesStr) ? implode(' | ', $variacoesStr) : 'Preço sob consulta';
                $descTexto = $prod->descricao ? " ({$prod->descricao})" : '';
                $linhas[] = "• **{$prod->nome}**{$descTexto} — {$varTexto}";
            }
        }

        $textoCompleto = implode("\n", $linhas);
        return response()->json([
            'ok' => true,
            'cardapio_texto' => $textoCompleto,
            'total_categorias' => $categorias->count(),
        ]);
    }

    /**
     * Cadastra um novo prato/produto com suas variações de tamanho e preço
     */
    public function store(Request $request)
    {
        $request->validate([
            'categoria_id' => 'required|exists:categorias,id',
            'nome' => 'required|string|max:150',
            'tipo' => 'nullable|in:prato_executivo,prato_do_dia,porcao,adicional,bebida,cerveja',
            'descricao' => 'nullable|string',
            'dias_disponiveis' => 'nullable|string',
            'ativo' => 'nullable|boolean',
            'variacoes' => 'required|array|min:1',
            'variacoes.*.tamanho' => 'required|string|max:50',
            'variacoes.*.preco' => 'required|numeric|min:0',
        ]);

        return DB::transaction(function () use ($request) {
            $categoria = Categoria::find($request->categoria_id);
            $tipoPadrao = 'prato_executivo';
            if ($categoria) {
                if (str_contains($categoria->slug, 'bebida')) $tipoPadrao = 'bebida';
                elseif (str_contains($categoria->slug, 'cerveja')) $tipoPadrao = 'cerveja';
                elseif (str_contains($categoria->slug, 'porcao') || str_contains($categoria->slug, 'porcoe')) $tipoPadrao = 'porcao';
                elseif (str_contains($categoria->slug, 'adicional')) $tipoPadrao = 'adicional';
                elseif (str_contains($categoria->slug, 'dia')) $tipoPadrao = 'prato_do_dia';
            }

            $produto = Produto::create([
                'categoria_id' => $request->categoria_id,
                'tipo' => $request->input('tipo', $tipoPadrao),
                'nome' => $request->nome,
                'descricao' => $request->descricao,
                'dias_disponiveis' => $request->input('dias_disponiveis', 'todos'),
                'ativo' => $request->boolean('ativo', true),
            ]);

            foreach ($request->variacoes as $v) {
                ProdutoVariacao::create([
                    'produto_id' => $produto->id,
                    'tamanho' => $v['tamanho'],
                    'preco' => $v['preco'],
                    'ativo' => true,
                ]);
            }

            return response()->json([
                'message' => 'Prato/produto cadastrado com sucesso',
                'produto' => $produto->load('variacoes', 'categoria')
            ], 201);
        });
    }

    /**
     * Exibe um prato/produto específico
     */
    public function show($id)
    {
        $produto = Produto::with(['variacoes', 'categoria'])->findOrFail($id);
        return response()->json($produto);
    }

    /**
     * Atualiza um prato/produto e suas variações
     */
    public function update(Request $request, $id)
    {
        $produto = Produto::findOrFail($id);

        $request->validate([
            'categoria_id' => 'sometimes|exists:categorias,id',
            'nome' => 'sometimes|string|max:150',
            'tipo' => 'nullable|in:prato_executivo,prato_do_dia,porcao,adicional,bebida,cerveja',
            'descricao' => 'nullable|string',
            'dias_disponiveis' => 'nullable|string',
            'ativo' => 'nullable|boolean',
            'variacoes' => 'nullable|array|min:1',
            'variacoes.*.tamanho' => 'required|string|max:50',
            'variacoes.*.preco' => 'required|numeric|min:0',
        ]);

        return DB::transaction(function () use ($request, $produto) {
            $produto->update($request->only([
                'categoria_id',
                'tipo',
                'nome',
                'descricao',
                'dias_disponiveis',
                'ativo',
            ]));

            if ($request->has('variacoes')) {
                // Substitui ou sincroniza variações
                $produto->variacoes()->delete();
                foreach ($request->variacoes as $v) {
                    ProdutoVariacao::create([
                        'produto_id' => $produto->id,
                        'tamanho' => $v['tamanho'],
                        'preco' => $v['preco'],
                        'ativo' => isset($v['ativo']) ? (bool) $v['ativo'] : true,
                    ]);
                }
            }

            return response()->json([
                'message' => 'Prato/produto atualizado com sucesso',
                'produto' => $produto->fresh(['variacoes', 'categoria'])
            ]);
        });
    }

    /**
     * Remove um prato/produto do cardápio
     */
    public function destroy($id)
    {
        $produto = Produto::findOrFail($id);
        $produto->delete();

        return response()->json([
            'message' => 'Prato/produto removido do cardápio com sucesso'
        ]);
    }

    /**
     * Alterna o status ativo / não ativo (pausado) do prato
     */
    public function toggleProdutoStatus($id)
    {
        $produto = Produto::findOrFail($id);
        $produto->ativo = !$produto->ativo;
        $produto->save();

        return response()->json([
            'message' => 'Status do produto alterado com sucesso',
            'ativo' => $produto->ativo,
            'produto' => $produto
        ]);
    }
}
