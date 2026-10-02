<?php

namespace App\Http\Controllers;

use App\Models\Atendimento;
use App\Models\Cliente;
use App\Models\StatusConversa;
use Carbon\Carbon;
use Illuminate\Http\Request;

class AtendimentoController extends Controller
{
    /**
     * Lista atendimentos registrados para o dashboard
     */
    public function index(Request $request)
    {
        $query = Atendimento::with(['cliente', 'pedido']);

        if ($request->has('transbordo')) {
            $query->where('transbordo_humano', $request->boolean('transbordo'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $atendimentos = $query->orderBy('created_at', 'DESC')->paginate(max(1, min(100, (int) $request->query('per_page', 15))));

        return response()->json($atendimentos);
    }

    /**
     * Sincroniza em tempo real o status conversacional vindo do robô ou simulador
     */
    public function syncStatus(Request $request)
    {
        $request->validate([
            'telefone' => ['required', 'regex:/^\d{10,15}$/'],
            'status' => 'required|in:conversa_iniciada,fazendo_pedido_pratos,fazendo_pedido_bebidas,coletando_endereco,coletando_pagamento,preparando_na_cozinha,saiu_para_entrega,cancelado_apos_30_minutos',
            'rascunho' => 'nullable|array',
            'nome' => 'nullable|string|max:150',
            'motivo_transbordo' => 'nullable|string|max:255',
            'expirou' => 'nullable|boolean',
            'registrar_mensagem' => 'nullable|boolean',
        ]);

        $tel = preg_replace('/\D/', '', $request->input('telefone'));
        $statusAtual = $request->input('status');
        $rascunho = $request->input('rascunho', []);
        $transbordo = $request->boolean('transbordo', false);
        $motivoTransbordo = $request->input('motivo_transbordo');

        // 1. Garante o Cliente cadastrado
        $cliente = Cliente::firstOrCreate(
            ['telefone' => $tel],
            [
                'nome' => ($request->input('nome') ?: 'Cliente WhatsApp'),
                'primeiro_contato_em' => Carbon::now(),
                'ultimo_contato_em' => Carbon::now(),
            ]
        );
        $cliente->update(['ultimo_contato_em' => Carbon::now()]);

        // 2. Registra / Atualiza a tabela status_conversas
        $statusAnterior = null;
        $statusConversa = StatusConversa::where('telefone', $tel)->first();
        if ($statusConversa) {
            $statusAnterior = $statusConversa->status_atual;
        }

        $statusConversa = StatusConversa::updateOrCreate(
            ['telefone' => $tel],
            [
                'status_atual' => $statusAtual,
                'status_anterior' => $statusAnterior,
                'rascunho' => $rascunho,
                'ultimo_contato_em' => Carbon::now(),
                'expira_em' => Carbon::now()->addMinutes(30),
            ]
        );

        // 3. Atualiza ou cria sessão de atendimento na tabela atendimentos
        $atendimento = Atendimento::where('cliente_id', $cliente->id)
            ->where('status', 'em_andamento')
            ->latest('id')
            ->first();

        if (! $atendimento) {
            $atendimento = Atendimento::create([
                'cliente_id' => $cliente->id,
                'inicio_em' => Carbon::now(),
                'status' => 'em_andamento',
                'total_mensagens_cliente' => 0,
                'total_mensagens_bot' => 0,
                'canal' => 'whatsapp',
            ]);
        }

        if ($request->boolean('registrar_mensagem')) {
            $atendimento->increment('total_mensagens_cliente');
            $atendimento->increment('total_mensagens_bot');
        }

        if ($transbordo) {
            $atendimento->status = 'transbordo_humano';
            $atendimento->transbordo_humano = true;
            $atendimento->motivo_transbordo = $motivoTransbordo ?: 'Transferência solicitada';
            $atendimento->fim_em = Carbon::now();
            $atendimento->save();
        } elseif ($statusAtual === 'preparando_na_cozinha') {
            $atendimento->status = 'finalizado_com_pedido';
            $atendimento->fim_em = Carbon::now();
            $atendimento->save();
        } elseif ($statusAtual === 'cancelado_apos_30_minutos' || $request->boolean('expirou')) {
            $atendimento->status = 'abandonado';
            $atendimento->fim_em = Carbon::now();
            $atendimento->save();
        }

        return response()->json([
            'ok' => true,
            'status_conversa' => $statusConversa,
            'atendimento' => $atendimento,
        ]);
    }

    /**
     * Lista os status conversacionais ativos
     */
    public function getStatusConversas()
    {
        $status = StatusConversa::orderBy('ultimo_contato_em', 'DESC')->get();

        return response()->json($status);
    }
}
