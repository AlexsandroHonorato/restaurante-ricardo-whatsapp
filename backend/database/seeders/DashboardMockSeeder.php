<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Cliente;
use App\Models\Endereco;
use App\Models\Pedido;
use App\Models\PedidoItem;
use App\Models\PedidoItemAdicional;
use App\Models\Atendimento;
use App\Models\HistoricoStatusPedido;
use App\Models\Produto;
use Carbon\Carbon;

class DashboardMockSeeder extends Seeder
{
    public function run(): void
    {
        $clientesData = [
            ['nome' => 'Carlos Silva', 'telefone' => '5512997112233', 'bairro' => 'Martim de Sá', 'rua' => 'Av. Irineu Mendes de Souza', 'num' => '100'],
            ['nome' => 'Mariana Souza', 'telefone' => '5512981223344', 'bairro' => 'Centro', 'rua' => 'Rua Altino Arantes', 'num' => '450'],
            ['nome' => 'Lucas Ferreira', 'telefone' => '5512991334455', 'bairro' => 'Indaiá', 'rua' => 'Av. Marechal Deodoro', 'num' => '820'],
            ['nome' => 'Fernanda Lima', 'telefone' => '5512996445566', 'bairro' => 'Prainha', 'rua' => 'Rua da Praia', 'num' => '55'],
            ['nome' => 'Roberto Rocha', 'telefone' => '5512988556677', 'bairro' => 'Sumaré', 'rua' => 'Rua dos Coqueiros', 'num' => '312'],
            ['nome' => 'Juliana Costa', 'telefone' => '5512992667788', 'bairro' => 'Martim de Sá', 'rua' => 'Rua das Gaivotas', 'num' => '78'],
            ['nome' => 'André Mendes', 'telefone' => '5512983778899', 'bairro' => 'Porto Novo', 'rua' => 'Av. Primeiro de Maio', 'num' => '1420'],
            ['nome' => 'Camila Duarte', 'telefone' => '5512994889900', 'bairro' => 'Centro', 'rua' => 'Rua Santa Cruz', 'num' => '95'],
        ];

        $clientes = [];
        $enderecos = [];

        foreach ($clientesData as $c) {
            $cliente = Cliente::updateOrCreate(['telefone' => $c['telefone']], [
                'nome' => $c['nome'],
                'primeiro_contato_em' => Carbon::now()->subDays(rand(1, 30)),
                'ultimo_contato_em' => Carbon::now(),
                'total_pedidos' => 0,
                'total_gasto' => 0,
            ]);

            $endereco = Endereco::create([
                'cliente_id' => $cliente->id,
                'logradouro' => $c['rua'],
                'numero' => $c['num'],
                'bairro' => $c['bairro'],
                'cidade' => 'Caraguatatuba',
                'estado' => 'SP',
                'padrao' => true,
            ]);

            $clientes[] = $cliente;
            $enderecos[] = $endereco;
        }

        $produtos = Produto::with('variacoes')->get();
        $formasPagamento = ['pix', 'cartao_credito', 'cartao_debito', 'dinheiro'];
        $statuses = ['entregue', 'entregue', 'entregue', 'em_preparo', 'saiu_para_entrega', 'pendente'];

        for ($i = 1; $i <= 25; $i++) {
            $clienteIndex = array_rand($clientes);
            $cliente = $clientes[$clienteIndex];
            $endereco = $enderecos[$clienteIndex];

            $dataPedido = Carbon::now()->subHours(rand(0, 120));
            $status = $statuses[array_rand($statuses)];
            $formaPagamento = $formasPagamento[array_rand($formasPagamento)];

            $codigo = 'PED-' . $dataPedido->format('dHi') . '-' . strtoupper(substr(md5(uniqid()), 0, 3));

            $pedido = Pedido::create([
                'codigo_pedido' => $codigo,
                'cliente_id' => $cliente->id,
                'endereco_id' => $endereco->id,
                'status' => $status,
                'forma_pagamento' => $formaPagamento,
                'valor_subtotal' => 0,
                'taxa_entrega' => 5.00,
                'valor_total' => 0,
                'tempo_estimado_min' => 50,
                'observacoes' => rand(0, 1) ? 'Sem cebola na salada por favor' : null,
                'origem' => 'whatsapp_ia',
                'created_at' => $dataPedido,
                'updated_at' => $dataPedido,
            ]);

            $numItens = rand(1, 3);
            $subtotal = 0;

            for ($j = 0; $j < $numItens; $j++) {
                $prod = $produtos->random();
                $var = $prod->variacoes->isNotEmpty() ? $prod->variacoes->random() : null;
                $preco = $var ? $var->preco : 25.00;
                $tamanho = $var ? $var->tamanho : 'Padrão';
                $qtd = rand(1, 2);
                $itemSubtotal = $preco * $qtd;
                $subtotal += $itemSubtotal;

                $item = PedidoItem::create([
                    'pedido_id' => $pedido->id,
                    'produto_id' => $prod->id,
                    'variacao_id' => $var ? $var->id : null,
                    'nome_snapshot' => $prod->nome,
                    'tamanho_snapshot' => $tamanho,
                    'quantidade' => $qtd,
                    'preco_unitario' => $preco,
                    'subtotal' => $itemSubtotal,
                ]);

                if ($prod->tipo === 'prato_executivo' && rand(0, 1)) {
                    PedidoItemAdicional::create([
                        'pedido_item_id' => $item->id,
                        'nome_snapshot' => 'Ovo Frito',
                        'quantidade' => 1,
                        'preco_unitario' => 2.00,
                        'subtotal' => 2.00,
                    ]);
                    $subtotal += 2.00;
                }
            }

            $total = $subtotal + 5.00;
            $pedido->update([
                'valor_subtotal' => $subtotal,
                'valor_total' => $total,
            ]);

            // Atualiza LTV do cliente
            if ($status === 'entregue') {
                $cliente->increment('total_pedidos');
                $cliente->increment('total_gasto', $total);
            }

            // Histórico de status
            HistoricoStatusPedido::create([
                'pedido_id' => $pedido->id,
                'status_anterior' => null,
                'status_novo' => 'pendente',
                'alterado_em' => $dataPedido,
                'alterado_por' => 'ia_bot',
            ]);

            if (in_array($status, ['em_preparo', 'saiu_para_entrega', 'entregue'])) {
                HistoricoStatusPedido::create([
                    'pedido_id' => $pedido->id,
                    'status_anterior' => 'pendente',
                    'status_novo' => 'em_preparo',
                    'alterado_em' => $dataPedido->copy()->addMinutes(10),
                    'alterado_por' => 'cozinha',
                ]);
            }

            // Atendimento correspondente
            Atendimento::create([
                'cliente_id' => $cliente->id,
                'pedido_id' => $pedido->id,
                'inicio_em' => $dataPedido->copy()->subMinutes(8),
                'fim_em' => $dataPedido,
                'duracao_segundos' => 480,
                'status' => 'finalizado_com_pedido',
                'total_mensagens_cliente' => rand(4, 8),
                'total_mensagens_bot' => rand(4, 8),
                'transbordo_humano' => false,
                'tokens_estimados' => rand(800, 1500),
                'canal' => 'whatsapp',
                'created_at' => $dataPedido,
            ]);
        }

        // Adiciona alguns atendimentos com transbordo humano para enriquecer as métricas
        for ($k = 0; $k < 5; $k++) {
            $cliente = $clientes[array_rand($clientes)];
            $motivos = ['atraso_pedido', 'duvida_cardapio_especial', 'solicitado_pelo_cliente', 'erro_chave_pix'];
            Atendimento::create([
                'cliente_id' => $cliente->id,
                'inicio_em' => Carbon::now()->subHours(rand(1, 48)),
                'fim_em' => Carbon::now()->subHours(rand(1, 48))->addMinutes(15),
                'duracao_segundos' => 900,
                'status' => 'transbordo_humano',
                'total_mensagens_cliente' => 5,
                'total_mensagens_bot' => 4,
                'transbordo_humano' => true,
                'motivo_transbordo' => $motivos[array_rand($motivos)],
                'tokens_estimados' => 650,
                'canal' => 'whatsapp',
            ]);
        }
    }
}
