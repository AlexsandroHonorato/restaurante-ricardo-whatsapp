<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Pedido;
use App\Models\PedidoItem;
use App\Models\Cliente;
use App\Models\Atendimento;
use App\Models\Endereco;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class DashboardController extends Controller
{
    /**
     * Retorna os KPIs consolidados em tempo real
     */
    public function getKpis()
    {
        $hoje = Carbon::today();

        $faturamentoTotal = Pedido::where('status', '!=', 'cancelado')->sum('valor_total');
        $faturamentoHoje = Pedido::where('status', '!=', 'cancelado')->whereDate('created_at', $hoje)->sum('valor_total');

        $totalPedidos = Pedido::count();
        $pedidosHoje = Pedido::whereDate('created_at', $hoje)->count();

        $ticketMedio = Pedido::where('status', '!=', 'cancelado')->avg('valor_total') ?? 0;
        $totalClientes = Cliente::count();

        $pedidosPorStatus = [
            'pendente' => Pedido::where('status', 'pendente')->count(),
            'em_preparo' => Pedido::where('status', 'em_preparo')->count(),
            'saiu_para_entrega' => Pedido::where('status', 'saiu_para_entrega')->count(),
            'entregue' => Pedido::where('status', 'entregue')->count(),
            'cancelado' => Pedido::where('status', 'cancelado')->count(),
        ];

        $totalAtendimentos = Atendimento::count();
        $convertidosEmPedido = Atendimento::where('status', 'finalizado_com_pedido')->count();
        $taxaConversaoIa = $totalAtendimentos > 0 ? round(($convertidosEmPedido / $totalAtendimentos) * 100, 1) : 0;
        $totalTransbordoHumano = Atendimento::where('transbordo_humano', true)->count();
        $taxaTransbordo = $totalAtendimentos > 0 ? round(($totalTransbordoHumano / $totalAtendimentos) * 100, 1) : 0;
        $tmaSegundos = Atendimento::avg('duracao_segundos') ?? 0;

        return response()->json([
            'faturamento_total' => (float) $faturamentoTotal,
            'faturamento_hoje' => (float) $faturamentoHoje,
            'total_pedidos' => $totalPedidos,
            'pedidos_hoje' => $pedidosHoje,
            'ticket_medio' => round((float) $ticketMedio, 2),
            'total_clientes' => $totalClientes,
            'pedidos_por_status' => $pedidosPorStatus,
            'taxa_conversao_ia' => $taxaConversaoIa,
            'total_transbordo_humano' => $totalTransbordoHumano,
            'taxa_transbordo' => $taxaTransbordo,
            'tempo_medio_atendimento_min' => round($tmaSegundos / 60, 1),
        ]);
    }

    /**
     * Gráfico de vendas temporal (últimos 7 ou 30 dias)
     */
    public function getSalesChart(Request $request)
    {
        $dias = $request->query('dias', 7);
        $dataInicio = Carbon::today()->subDays($dias - 1);

        $vendas = Pedido::select(
            DB::raw('DATE(created_at) as data'),
            DB::raw('COUNT(id) as total_pedidos'),
            DB::raw('SUM(CASE WHEN status != "cancelado" THEN valor_total ELSE 0 END) as faturamento')
        )
        ->where('created_at', '>=', $dataInicio)
        ->groupBy('data')
        ->orderBy('data', 'ASC')
        ->get();

        return response()->json($vendas);
    }

    /**
     * Ranking dos produtos mais vendidos
     */
    public function getTopProducts()
    {
        $top = PedidoItem::select(
            'nome_snapshot as produto',
            'tamanho_snapshot as tamanho',
            DB::raw('SUM(quantidade) as total_quantidade'),
            DB::raw('SUM(subtotal) as total_faturado')
        )
        ->join('pedidos', 'pedido_itens.pedido_id', '=', 'pedidos.id')
        ->where('pedidos.status', '!=', 'cancelado')
        ->groupBy('nome_snapshot', 'tamanho_snapshot')
        ->orderBy('total_quantidade', 'DESC')
        ->limit(8)
        ->get();

        return response()->json($top);
    }

    /**
     * Mapa de calor / entregas por bairro
     */
    public function getDeliveryByNeighborhood()
    {
        $bairros = DB::table('pedidos')
            ->leftJoin('enderecos', 'pedidos.endereco_id', '=', 'enderecos.id')
            ->select(
                DB::raw('COALESCE(enderecos.bairro, "Balcão / Não Informado") as bairro'),
                DB::raw('COUNT(pedidos.id) as total_pedidos'),
                DB::raw('SUM(CASE WHEN pedidos.status != "cancelado" THEN pedidos.valor_total ELSE 0 END) as total_faturamento')
            )
            ->groupBy('bairro')
            ->orderBy('total_pedidos', 'DESC')
            ->get();

        return response()->json($bairros);
    }

    /**
     * Distribuição de formas de pagamento
     */
    public function getPaymentMethods()
    {
        $pagamentos = Pedido::select(
            'forma_pagamento',
            DB::raw('COUNT(id) as quantidade'),
            DB::raw('SUM(valor_total) as faturamento')
        )
        ->where('status', '!=', 'cancelado')
        ->groupBy('forma_pagamento')
        ->orderBy('quantidade', 'DESC')
        ->get();

        return response()->json($pagamentos);
    }

    /**
     * Métricas detalhadas de inteligência artificial e conversão
     */
    public function getAiMetrics()
    {
        $totalAtendimentos = Atendimento::count();
        $porStatus = Atendimento::select('status', DB::raw('COUNT(id) as total'))
            ->groupBy('status')
            ->get();

        $motivosTransbordo = Atendimento::whereNotNull('motivo_transbordo')
            ->select('motivo_transbordo', DB::raw('COUNT(id) as total'))
            ->groupBy('motivo_transbordo')
            ->orderBy('total', 'DESC')
            ->get();

        $mensagensMedia = Atendimento::select(
            DB::raw('AVG(total_mensagens_cliente) as media_cliente'),
            DB::raw('AVG(total_mensagens_bot) as media_bot'),
            DB::raw('AVG(duracao_segundos) as media_duracao_segundos')
        )->first();

        return response()->json([
            'total_atendimentos' => $totalAtendimentos,
            'por_status' => $porStatus,
            'motivos_transbordo' => $motivosTransbordo,
            'media_mensagens_cliente' => round($mensagensMedia->media_cliente ?? 0, 1),
            'media_mensagens_bot' => round($mensagensMedia->media_bot ?? 0, 1),
            'media_duracao_segundos' => round($mensagensMedia->media_duracao_segundos ?? 0, 0),
        ]);
    }
}
