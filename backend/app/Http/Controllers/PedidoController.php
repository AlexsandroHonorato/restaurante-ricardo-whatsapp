<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Pedido;
use App\Models\HistoricoStatusPedido;
use Carbon\Carbon;

class PedidoController extends Controller
{
    /**
     * Listagem de pedidos com filtros de status e busca
     */
    public function index(Request $request)
    {
        $query = Pedido::with(['cliente', 'endereco', 'itens.adicionais']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('busca')) {
            $busca = $request->busca;
            $query->where(function($q) use ($busca) {
                $q->where('codigo_pedido', 'like', "%{$busca}%")
                  ->orWhereHas('cliente', function($qc) use ($busca) {
                      $qc->where('nome', 'like', "%{$busca}%")
                         ->orWhere('telefone', 'like', "%{$busca}%");
                  });
            });
        }

        $pedidos = $query->orderBy('created_at', 'DESC')->paginate($request->query('per_page', 15));

        return response()->json($pedidos);
    }

    /**
     * Exibe um pedido específico com todo o histórico
     */
    public function show($id)
    {
        $pedido = Pedido::with(['cliente', 'endereco', 'itens.adicionais', 'historicoStatus', 'atendimento'])->findOrFail($id);
        return response()->json($pedido);
    }

    /**
     * Atualiza o status do pedido (ex: de 'em_preparo' para 'saiu_para_entrega')
     */
    public function updateStatus(Request $request, $id)
    {
        $request->validate([
            'status' => 'required|in:pendente,confirmado,em_preparo,saiu_para_entrega,entregue,cancelado',
            'alterado_por' => 'nullable|string',
            'observacao' => 'nullable|string',
        ]);

        $pedido = Pedido::findOrFail($id);
        $statusAnterior = $pedido->status;
        $statusNovo = $request->status;

        $pedido->status = $statusNovo;
        if ($statusNovo === 'em_preparo' && !$pedido->preparado_em) {
            $pedido->preparado_em = Carbon::now();
        } elseif ($statusNovo === 'saiu_para_entrega' && !$pedido->saiu_entrega_em) {
            $pedido->saiu_entrega_em = Carbon::now();
        } elseif ($statusNovo === 'entregue' && !$pedido->entregue_em) {
            $pedido->entregue_em = Carbon::now();
        } elseif ($statusNovo === 'cancelado' && !$pedido->cancelado_em) {
            $pedido->cancelado_em = Carbon::now();
        }
        $pedido->save();

        HistoricoStatusPedido::create([
            'pedido_id' => $pedido->id,
            'status_anterior' => $statusAnterior,
            'status_novo' => $statusNovo,
            'alterado_por' => $request->input('alterado_por', 'painel_admin'),
            'observacao' => $request->input('observacao'),
        ]);

        // Sincroniza o status conversacional ativo do cliente
        if ($pedido->cliente && $pedido->cliente->telefone) {
            \App\Models\StatusConversa::updateOrCreate(
                ['telefone' => $pedido->cliente->telefone],
                [
                    'status_atual' => $statusNovo,
                    'status_anterior' => $statusAnterior,
                    'ultimo_contato_em' => Carbon::now(),
                ]
            );
        }

        // Dispara notificação automática para o WhatsApp do cliente se saiu para entrega com idempotência
        $mensagemNotificacao = null;
        if ($statusNovo === 'saiu_para_entrega') {
            $mensagemNotificacao = "🛵💨 Temos uma ótima notícia! O seu pedido {$pedido->codigo_pedido} acabou de sair para entrega e está a caminho! Em breve nosso motoboy chegará ao seu endereço.";
            // Só dispara se o status anterior ainda não era saiu_para_entrega
            if ($statusAnterior !== 'saiu_para_entrega' && $pedido->cliente && $pedido->cliente->telefone) {
                try {
                    \Illuminate\Support\Facades\Http::timeout(3)->post('http://127.0.0.1:3000/api/notificar', [
                        'para' => $pedido->cliente->telefone,
                        'texto' => $mensagemNotificacao,
                        'idempotency_key' => "despacho_{$pedido->id}_{$pedido->codigo_pedido}",
                    ]);
                } catch (\Throwable $e) {
                    // Tratamento resiliente se o serviço do webhook estiver ocupado
                }
            }
        }


        return response()->json([
            'message' => 'Status atualizado com sucesso',
            'notificacao_whatsapp' => $mensagemNotificacao,
            'pedido' => $pedido->fresh(['cliente', 'endereco', 'itens', 'historicoStatus'])
        ]);
    }

    /**
     * Registra novo pedido vindo do WhatsApp / Robô ou API
     */
    public function store(Request $request)
    {
        $tel = preg_replace('/\D/', '', $request->input('telefone', ''));
        $nome = $request->input('nome', 'Cliente WhatsApp');

        $cliente = \App\Models\Cliente::firstOrCreate(
            ['telefone' => $tel ?: '5511900000000'],
            [
                'nome' => $nome,
                'primeiro_contato_em' => Carbon::now(),
                'ultimo_contato_em' => Carbon::now(),
                'total_pedidos' => 0,
                'total_gasto' => 0,
            ]
        );
        $cliente->update(['ultimo_contato_em' => Carbon::now(), 'nome' => $nome]);

        $enderecoStr = $request->input('endereco', 'Martim de Sá');
        $bairro = 'Martim de Sá';
        if (stripos($enderecoStr, 'centro') !== false) $bairro = 'Centro';
        elseif (stripos($enderecoStr, 'indai') !== false) $bairro = 'Indaiá';
        elseif (stripos($enderecoStr, 'prainha') !== false) $bairro = 'Prainha';
        elseif (stripos($enderecoStr, 'porto') !== false) $bairro = 'Porto Novo';

        $endereco = \App\Models\Endereco::create([
            'cliente_id' => $cliente->id,
            'logradouro' => $enderecoStr,
            'numero' => 'S/N',
            'bairro' => $bairro,
            'cidade' => 'Caraguatatuba',
            'estado' => 'SP',
            'padrao' => true,
        ]);

        $totalRaw = $request->input('total', '0');
        $totalLimpo = preg_replace('/[^\d,.]/', '', str_replace(['R$', ' '], '', $totalRaw));
        $totalNum = (float) (str_contains($totalLimpo, ',') ? str_replace(',', '.', $totalLimpo) : $totalLimpo);
        if ($totalNum <= 0) $totalNum = 30.00;

        $trocoParaRaw = $request->input('trocoPara');
        $trocoPara = $trocoParaRaw ? (float) preg_replace('/[^\d,.]/', '', str_replace(['R$', ' '], '', $trocoParaRaw)) : null;

        $formaPag = strtolower($request->input('formaPagamento', 'pix'));
        if (str_contains($formaPag, 'dinheiro')) $formaPag = 'dinheiro';
        elseif (str_contains($formaPag, 'crédito') || str_contains($formaPag, 'credito')) $formaPag = 'cartao_credito';
        elseif (str_contains($formaPag, 'débito') || str_contains($formaPag, 'debito')) $formaPag = 'cartao_debito';
        else $formaPag = 'pix';

        $codigo = $request->input('codigo_pedido') ?: 'PED-' . date('dHi') . '-' . strtoupper(substr(md5(uniqid()), 0, 3));

        $pedido = Pedido::create([
            'codigo_pedido' => $codigo,
            'cliente_id' => $cliente->id,
            'endereco_id' => $endereco->id,
            'status' => 'em_preparo',
            'forma_pagamento' => $formaPag,
            'valor_subtotal' => max(0, $totalNum - 5.00),
            'taxa_entrega' => 5.00,
            'valor_total' => $totalNum,
            'troco_para' => $trocoPara,
            'valor_troco' => ($trocoPara && $trocoPara > $totalNum) ? ($trocoPara - $totalNum) : null,
            'tempo_estimado_min' => 50,
            'observacoes' => $request->input('observacoes'),
            'origem' => 'whatsapp_ia',
            'preparado_em' => Carbon::now(),
        ]);

        $itens = $request->input('itens', []);
        foreach ($itens as $itemStr) {
            $nomeItem = is_string($itemStr) ? $itemStr : json_encode($itemStr);
            \App\Models\PedidoItem::create([
                'pedido_id' => $pedido->id,
                'nome_snapshot' => $nomeItem,
                'tamanho_snapshot' => 'Padrão',
                'quantidade' => 1,
                'preco_unitario' => $totalNum,
                'subtotal' => $totalNum,
            ]);
        }

        $cliente->increment('total_pedidos');
        $cliente->increment('total_gasto', $totalNum);

        \App\Models\HistoricoStatusPedido::create([
            'pedido_id' => $pedido->id,
            'status_anterior' => 'pendente',
            'status_novo' => 'em_preparo',
            'alterado_por' => 'ia_bot',
        ]);

        \App\Models\Atendimento::create([
            'cliente_id' => $cliente->id,
            'pedido_id' => $pedido->id,
            'inicio_em' => Carbon::now()->subMinutes(5),
            'fim_em' => Carbon::now(),
            'duracao_segundos' => 300,
            'status' => 'finalizado_com_pedido',
            'total_mensagens_cliente' => 4,
            'total_mensagens_bot' => 4,
            'transbordo_humano' => false,
            'canal' => 'whatsapp',
        ]);

        return response()->json([
            'message' => 'Pedido registrado com sucesso',
            'pedido' => $pedido->load(['cliente', 'endereco', 'itens'])
        ], 201);
    }
}
