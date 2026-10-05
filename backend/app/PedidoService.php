<?php

namespace App;

use App\Models\Atendimento;
use App\Models\Cliente;
use App\Models\Endereco;
use App\Models\HistoricoStatusPedido;
use App\Models\Pedido;
use App\Models\ProdutoVariacao;
use App\Support\DiasCardapio;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PedidoService
{
    public function registrar(array $dados): Pedido
    {
        // Preço, disponibilidade e total vêm do cardápio no banco; nada de valor informado pela IA é aceito.
        $itens = $this->resolverItens($dados['itens']);
        $subtotal = array_sum(array_column($itens, 'subtotal_centavos'));
        $taxa = isset($dados['taxa_entrega']) ? ValorMonetario::centavos($dados['taxa_entrega'], 'taxa_entrega') : 0;
        $total = $subtotal + $taxa;
        $troco = isset($dados['trocoPara']) ? ValorMonetario::centavos($dados['trocoPara'], 'trocoPara') : null;
        $pagamento = mb_strtolower($dados['formaPagamento']);
        $pagamento = match (true) {
            str_contains($pagamento, 'dinheiro') => 'dinheiro',
            str_contains($pagamento, 'crédito'), str_contains($pagamento, 'credito') => 'cartao_credito',
            str_contains($pagamento, 'débito'), str_contains($pagamento, 'debito') => 'cartao_debito',
            $pagamento === 'pix' => 'pix',
            default => throw ValidationException::withMessages(['formaPagamento' => 'Pagamento inválido.']),
        };
        if ($total <= 0 || ($pagamento === 'dinheiro' && $troco !== null && $troco < $total)) {
            throw ValidationException::withMessages(['total' => 'Total inválido ou valor para troco insuficiente.']);
        }
        if ($total < 2500 && ! preg_match('/retirada|balc[aã]o/iu', $dados['endereco'])) {
            throw ValidationException::withMessages(['total' => 'Pedido mínimo para entrega: R$ 25,00.']);
        }

        return DB::transaction(function () use ($dados, $total, $troco, $pagamento, $itens, $subtotal, $taxa) {
            $cliente = Cliente::firstOrCreate(['telefone' => $dados['telefone']], [
                'nome' => $dados['nome'], 'primeiro_contato_em' => now(), 'ultimo_contato_em' => now(),
            ]);
            $cliente = Cliente::whereKey($cliente->id)->lockForUpdate()->firstOrFail();
            // Reenvio da mesma mensagem (chave) ou do mesmo código devolve o pedido já gravado.
            $existente = ! empty($dados['chave_idempotencia'])
                ? Pedido::where('chave_idempotencia', $dados['chave_idempotencia'])->first()
                : (! empty($dados['codigo_pedido']) ? Pedido::where('codigo_pedido', $dados['codigo_pedido'])->first() : null);
            if ($existente) {
                if ($existente->cliente_id !== $cliente->id) {
                    throw ValidationException::withMessages(['codigo_pedido' => 'Código já utilizado.']);
                }

                return $existente;
            }
            $dados['codigo_pedido'] ??= $this->novoCodigo();
            $cliente->update(['nome' => $dados['nome'], 'ultimo_contato_em' => now()]);
            $endereco = Endereco::create([
                'cliente_id' => $cliente->id, 'logradouro' => $dados['endereco'], 'numero' => 'S/N',
                'bairro' => $dados['bairro'] ?? 'Não informado', 'cidade' => 'Caraguatatuba', 'estado' => 'SP', 'padrao' => false,
            ]);
            $pedido = Pedido::create([
                'codigo_pedido' => $dados['codigo_pedido'], 'chave_idempotencia' => $dados['chave_idempotencia'] ?? null,
                'cliente_id' => $cliente->id, 'endereco_id' => $endereco->id,
                'status' => 'em_preparo', 'forma_pagamento' => $pagamento,
                'valor_subtotal' => $subtotal / 100, 'taxa_entrega' => $taxa / 100, 'valor_total' => $total / 100,
                'troco_para' => $pagamento === 'dinheiro' && $troco !== null ? $troco / 100 : null,
                'valor_troco' => $pagamento === 'dinheiro' && $troco !== null ? ($troco - $total) / 100 : null,
                'observacoes' => $dados['observacoes'] ?? null, 'origem' => 'whatsapp_ia', 'preparado_em' => now(),
            ]);
            foreach ($itens as $item) {
                unset($item['subtotal_centavos']);
                $pedido->itens()->create($item);
            }
            $cliente->increment('total_pedidos');
            $cliente->increment('total_gasto', $total / 100);
            HistoricoStatusPedido::create(['pedido_id' => $pedido->id, 'status_novo' => 'em_preparo', 'alterado_por' => 'ia_bot']);
            $atendimento = Atendimento::where('cliente_id', $cliente->id)->where('status', 'em_andamento')->latest('id')->first();
            if (! $atendimento) {
                $atendimento = new Atendimento(['cliente_id' => $cliente->id, 'inicio_em' => now(), 'canal' => 'whatsapp']);
            }
            $atendimento->fill([
                'pedido_id' => $pedido->id, 'status' => 'finalizado_com_pedido', 'fim_em' => now(),
                'duracao_segundos' => max(0, (int) $atendimento->inicio_em->diffInSeconds(now())),
            ])->save();

            return $pedido;
        });
    }

    /** PED-AAMMDD-NNN (data de São Paulo), sorteado e conferido no banco dentro da transação. */
    private function novoCodigo(): string
    {
        $prefixo = 'PED-'.now('America/Sao_Paulo')->format('ymd').'-';
        $usados = Pedido::where('codigo_pedido', 'like', $prefixo.'%')->pluck('codigo_pedido')->flip();
        $inicio = random_int(0, 899);
        for ($passo = 0; $passo < 900; $passo++) {
            $codigo = $prefixo.(100 + ($inicio + $passo) % 900);
            if (! $usados->has($codigo)) {
                return $codigo;
            }
        }
        throw ValidationException::withMessages(['codigo_pedido' => 'Números de pedido do dia esgotados.']);
    }

    /**
     * Cada item chega como {variacao_id, quantidade} (o código "[cod N]" do texto do cardápio).
     * Recusa com motivo legível, que o bot repassa ao cliente: código inexistente, pausado ou fora do dia.
     */
    private function resolverItens(array $itens): array
    {
        $variacoes = ProdutoVariacao::with('produto')->whereIn('id', array_column($itens, 'variacao_id'))->get()->keyBy('id');

        return array_map(function (array $item) use ($variacoes) {
            $variacao = $variacoes->get($item['variacao_id']);
            if (! $variacao || ! $variacao->produto) {
                throw ValidationException::withMessages(['itens' => "O item de código {$item['variacao_id']} não existe no cardápio."]);
            }
            $produto = $variacao->produto;
            if (! $variacao->ativo || ! $produto->ativo) {
                throw ValidationException::withMessages(['itens' => "{$produto->nome} ({$variacao->tamanho}) não está disponível no momento."]);
            }
            if (! DiasCardapio::disponivelHoje($produto->dias_disponiveis)) {
                throw ValidationException::withMessages(['itens' => "{$produto->nome} só é servido em: ".DiasCardapio::descrever($produto->dias_disponiveis).'.']);
            }
            $preco = ValorMonetario::centavos((string) $variacao->preco, 'itens');
            $quantidade = (int) $item['quantidade'];

            return [
                'produto_id' => $produto->id, 'variacao_id' => $variacao->id,
                'nome_snapshot' => $produto->nome, 'tamanho_snapshot' => $variacao->tamanho, 'quantidade' => $quantidade,
                'preco_unitario' => $preco / 100, 'subtotal' => $preco * $quantidade / 100, 'subtotal_centavos' => $preco * $quantidade,
            ];
        }, $itens);
    }
}
