<?php

namespace App;

use App\Models\Atendimento;
use App\Models\Cliente;
use App\Models\Endereco;
use App\Models\HistoricoStatusPedido;
use App\Models\Pedido;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PedidoService
{
    public function registrar(array $dados): Pedido
    {
        $total = ValorMonetario::centavos($dados['total']);
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
        $itens = array_map(fn ($item) => $this->normalizarItem($item), $dados['itens']);
        $subtotal = array_sum(array_column($itens, 'subtotal_centavos'));
        $taxa = isset($dados['taxa_entrega']) ? ValorMonetario::centavos($dados['taxa_entrega'], 'taxa_entrega') : 0;
        if ($subtotal + $taxa !== $total) {
            throw ValidationException::withMessages(['total' => 'O total deve corresponder aos itens e à taxa de entrega informada.']);
        }

        return DB::transaction(function () use ($dados, $total, $troco, $pagamento, $itens, $subtotal, $taxa) {
            $cliente = Cliente::firstOrCreate(['telefone' => $dados['telefone']], [
                'nome' => $dados['nome'], 'primeiro_contato_em' => now(), 'ultimo_contato_em' => now(),
            ]);
            $cliente = Cliente::whereKey($cliente->id)->lockForUpdate()->firstOrFail();
            $existente = Pedido::where('codigo_pedido', $dados['codigo_pedido'])->first();
            if ($existente) {
                if ($existente->cliente_id !== $cliente->id) {
                    throw ValidationException::withMessages(['codigo_pedido' => 'Código já utilizado.']);
                }

                return $existente;
            }
            $cliente->update(['nome' => $dados['nome'], 'ultimo_contato_em' => now()]);
            $endereco = Endereco::create([
                'cliente_id' => $cliente->id, 'logradouro' => $dados['endereco'], 'numero' => 'S/N',
                'bairro' => $dados['bairro'] ?? 'Não informado', 'cidade' => 'Caraguatatuba', 'estado' => 'SP', 'padrao' => false,
            ]);
            $pedido = Pedido::create([
                'codigo_pedido' => $dados['codigo_pedido'], 'cliente_id' => $cliente->id, 'endereco_id' => $endereco->id,
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

    private function normalizarItem(mixed $item): array
    {
        if (is_string($item)) {
            if (! preg_match('/^(?:(\d+)\s*x\s*)?(.+?)\s*-\s*R\$\s*([\d.,]+)\s*$/iu', $item, $partes)) {
                throw ValidationException::withMessages(['itens' => 'Cada item deve informar nome, quantidade e preço unitário.']);
            }
            $quantidade = (int) ($partes[1] ?: 1);
            $nome = trim($partes[2]);
            $tamanho = 'Padrão';
            if (preg_match('/^(.*?)\s*\(([^)]+)\)$/u', $nome, $descricao)) {
                $nome = trim($descricao[1]);
                $tamanho = $descricao[2];
            }
            $preco = ValorMonetario::centavos($partes[3], 'itens');
        } elseif (is_array($item)) {
            $quantidade = filter_var($item['qtd'] ?? 1, FILTER_VALIDATE_INT);
            $nome = $item['nome'] ?? '';
            $tamanho = $item['tamanho'] ?? 'Padrão';
            $preco = ValorMonetario::centavos($item['preco'] ?? null, 'itens');
        } else {
            throw ValidationException::withMessages(['itens' => 'Item inválido.']);
        }
        if (! $quantidade || $quantidade < 1 || $quantidade > 100 || ! is_string($nome) || ! trim($nome) || mb_strlen($nome) > 150 || ! is_string($tamanho) || mb_strlen($tamanho) > 50 || $preco <= 0) {
            throw ValidationException::withMessages(['itens' => 'Nome, tamanho, quantidade ou preço inválido.']);
        }

        return [
            'nome_snapshot' => $nome, 'tamanho_snapshot' => $tamanho, 'quantidade' => $quantidade,
            'preco_unitario' => $preco / 100, 'subtotal' => $preco * $quantidade / 100, 'subtotal_centavos' => $preco * $quantidade,
        ];
    }
}
