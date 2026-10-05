<?php

namespace App\Http\Controllers;

use App\Models\Atendimento;
use App\Models\Cliente;
use App\Models\Empresa;
use App\Models\MensagemWhatsapp;
use App\Models\StatusConversa;
use App\Support\ClientesSemResposta;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

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
            'status' => 'required|in:conversa_iniciada,fazendo_pedido_pratos,fazendo_pedido_bebidas,coletando_endereco,coletando_pagamento,preparando_na_cozinha,saiu_para_entrega,cancelado_apos_30_minutos,transbordo_humano',
            'rascunho' => 'nullable|array',
            'nome' => 'nullable|string|max:150',
            'motivo_transbordo' => 'nullable|string|max:255',
            'expirou' => 'nullable|boolean',
            'etapa_abandono' => 'nullable|string|max:80',
            'registrar_mensagem' => 'nullable|boolean',
        ]);

        $tel = preg_replace('/\D/', '', $request->input('telefone'));
        $statusAtual = $request->boolean('transbordo') ? 'transbordo_humano' : $request->input('status');
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
                // Novo pedido de atendente ($transbordo) zera o contato: o cliente volta para a fila de alertas.
                'contato_iniciado_em' => (! $transbordo && $statusAtual === 'transbordo_humano' && $statusAnterior === $statusAtual) ? $statusConversa?->contato_iniciado_em : null,
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
            $atendimento->etapa_abandono = $request->input('etapa_abandono') ?: $statusAnterior;
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
    public function iniciarContato(int $id)
    {
        $conversa = StatusConversa::findOrFail($id);
        abort_unless($conversa->status_atual === 'transbordo_humano', 409, 'Este cliente não está aguardando atendimento humano.');
        $atendimento = Atendimento::whereHas('cliente', fn ($q) => $q->where('telefone', $conversa->telefone))
            ->where('transbordo_humano', true)->latest('id')->first();
        $chave = 'contato_transbordo_'.$id.'_'.($atendimento?->id ?? $conversa->ultimo_contato_em->timestamp);
        try {
            return Cache::lock($chave.'_lock', 30)->block(5, function () use ($chave, $conversa) {
                if (! Cache::has($chave)) {
                    $resposta = Http::timeout(20)
                        ->withToken(config('services.bot.token') ?? '')
                        ->post(config('services.bot.url').'/api/notificar', [
                            'para' => $conversa->telefone,
                            'texto' => 'Olá! Sou da equipe do '.Empresa::nomeExibicao().'. Como posso ajudar você?',
                            'idempotency_key' => $chave,
                        ])->throw();
                    if ($resposta->json('ok') !== true) {
                        throw new \RuntimeException('Envio não confirmado');
                    }
                    Cache::put($chave, true, now()->addDay());
                }

                $conversa->update(['contato_iniciado_em' => $conversa->contato_iniciado_em ?? now()]);

                return response()->json(['ok' => true]);
            });
        } catch (\Throwable $e) {
            Log::warning('Falha no contato de transbordo', ['status_id' => $id, 'erro' => $e->getMessage()]);

            return response()->json(['message' => 'Não foi possível enviar a saudação. Tente novamente.'], 502);
        }
    }

    /** Tira o cliente da fila de alertas sem enviar saudação; a conversa continua no monitor, na mesma etapa. */
    public function excluirAlerta(int $id): JsonResponse
    {
        $conversa = StatusConversa::findOrFail($id);
        $conversa->update(['contato_iniciado_em' => $conversa->contato_iniciado_em ?? now()]);

        return response()->json(['ok' => true]);
    }

    /** Remove a conversa do monitor. Mensagens, pedidos e cliente ficam; nova mensagem do cliente recria o registro. */
    public function excluirConversa(int $id): JsonResponse
    {
        $conversa = StatusConversa::findOrFail($id);
        // A equipe encerrou a conversa: os avisos pendentes deste cliente (envio que falhou, mensagem sem resposta) saem junto.
        MensagemWhatsapp::where('telefone', $conversa->telefone)->where('direcao', 'saida')->where('status', 'falhou')->update(['status' => 'descartada']);
        ClientesSemResposta::dispensar($conversa->telefone);
        $conversa->delete();

        return response()->json(['ok' => true]);
    }

    public function getStatusConversas(Request $request)
    {
        // Monitor ao vivo (o painel consulta a cada 5 s): conversas do período (24 h, 7 ou 30 dias; padrão 24 h)
        // e os transbordos ainda sem contato, estes primeiro para nunca ficarem de fora do limite.
        $horas = in_array((int) $request->query('horas'), [24, 168, 720], true) ? (int) $request->query('horas') : 24;
        $status = StatusConversa::where('ultimo_contato_em', '>=', now()->subHours($horas))
            ->orWhere(fn ($q) => $q->where('status_atual', 'transbordo_humano')->whereNull('contato_iniciado_em'))
            ->orderByRaw("CASE WHEN status_atual = 'transbordo_humano' AND contato_iniciado_em IS NULL THEN 0 ELSE 1 END")
            ->orderBy('ultimo_contato_em', 'DESC')
            ->limit(200)
            ->get();

        return response()->json($status);
    }
}
