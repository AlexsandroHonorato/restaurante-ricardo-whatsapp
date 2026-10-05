<?php

namespace App\Support;

use App\Models\Atendimento;
use App\Models\Cliente;
use App\Models\Endereco;
use App\Models\MensagemWhatsapp;
use App\Models\Pedido;
use App\Models\PedidoItem;
use App\Models\StatusConversa;
use Illuminate\Support\Facades\DB;

/**
 * LGPD: remove o que identifica a pessoa (nome, telefone, endereço, conversas, observações) e
 * mantém o que é registro de venda (valores, itens, bairro para o mapa de entregas).
 */
class DadosPessoais
{
    public static function anonimizar(Cliente $cliente): void
    {
        DB::transaction(function () use ($cliente) {
            $telefone = $cliente->telefone;
            $pedidos = Pedido::where('cliente_id', $cliente->id)->pluck('id');
            Endereco::where('cliente_id', $cliente->id)->update([
                'logradouro' => 'Removido a pedido do cliente', 'numero' => '-', 'complemento' => null, 'ponto_referencia' => null, 'cep' => null,
            ]);
            Pedido::whereIn('id', $pedidos)->update(['observacoes' => null]);
            PedidoItem::whereIn('pedido_id', $pedidos)->update(['observacao' => null]);
            Atendimento::where('cliente_id', $cliente->id)->update(['motivo_transbordo' => null]);
            MensagemWhatsapp::where('telefone', $telefone)->delete();
            StatusConversa::where('telefone', $telefone)->delete();
            $cliente->forceFill(['nome' => 'Cliente removido', 'telefone' => "removido-{$cliente->id}", 'ativo' => false])->save();
        });
    }

    /** Rotina diária: conversas antigas e clientes sem contato há muito tempo. */
    public static function aplicarRetencao(int $diasMensagens, int $diasClientes): array
    {
        $mensagens = MensagemWhatsapp::where('created_at', '<', now()->subDays($diasMensagens))->delete();
        $clientes = 0;
        Cliente::where('ultimo_contato_em', '<', now()->subDays($diasClientes))
            ->where('telefone', 'not like', 'removido-%')
            ->each(function (Cliente $cliente) use (&$clientes) {
                self::anonimizar($cliente);
                $clientes++;
            });

        return ['mensagens' => $mensagens, 'clientes' => $clientes];
    }
}
