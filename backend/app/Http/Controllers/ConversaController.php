<?php

namespace App\Http\Controllers;

use App\Models\MensagemWhatsapp;
use App\Models\StatusConversa;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/** Atendimento humano dentro do painel: a equipe lê a conversa, responde e pausa/devolve o bot. */
class ConversaController extends Controller
{
    /** Ao responder, o bot fica em silêncio nesta conversa por este tempo (renovado a cada resposta da equipe). */
    private const PAUSA_HORAS = 2;

    public function mensagens(string $telefone): JsonResponse
    {
        $this->validarTelefone($telefone);
        $mensagens = MensagemWhatsapp::where('telefone', $telefone)->whereNotNull('texto')
            ->orderByDesc('id')->limit(100)->get(['id', 'direcao', 'texto', 'status', 'enviada_por', 'created_at'])->reverse()->values();

        return response()->json(['mensagens' => $mensagens, 'bot_pausado_ate' => $this->pausadoAte($telefone)]);
    }

    public function enviar(Request $request, string $telefone): JsonResponse
    {
        $this->validarTelefone($telefone);
        $texto = trim((string) $request->validate(['texto' => 'required|string|max:4096'])['texto']);
        abort_if($texto === '', 422, 'Escreva a mensagem.');
        // Gravada aqui com o autor; o bot envia pela mesma chave (saída durável, com reenvio automático).
        $mensagem = MensagemWhatsapp::create([
            'direcao' => 'saida', 'telefone' => $telefone, 'texto' => $texto, 'status' => 'pendente',
            'chave' => 'humano:'.Str::uuid(), 'enviada_por' => $request->user()->name, 'proxima_tentativa_em' => now()->addSeconds(30),
        ]);
        $this->pausar($telefone, true);
        $enviado = false;
        try {
            $resposta = Http::timeout(20)->withToken(config('services.bot.token') ?? '')
                ->post(config('services.bot.url').'/api/notificar', ['para' => $telefone, 'texto' => $texto, 'idempotency_key' => $mensagem->chave]);
            $enviado = $resposta->successful() && $resposta->json('ok') === true;
        } catch (\Throwable $e) {
            Log::warning('Mensagem da equipe ficou na fila', ['mensagem' => $mensagem->id, 'erro' => $e->getMessage()]);
        }

        return response()->json(['mensagem' => $mensagem->fresh(), 'enviado' => $enviado, 'bot_pausado_ate' => $this->pausadoAte($telefone)], 201);
    }

    public function alterarPausa(Request $request, string $telefone): JsonResponse
    {
        $this->validarTelefone($telefone);
        $this->pausar($telefone, $request->validate(['pausar' => 'required|boolean'])['pausar']);

        return response()->json(['bot_pausado_ate' => $this->pausadoAte($telefone)]);
    }

    /** Para o bot: se deve ficar em silêncio nesta conversa agora. */
    public function pausaParaBot(string $telefone): JsonResponse
    {
        $this->validarTelefone($telefone);

        return response()->json(['pausado' => $this->pausadoAte($telefone) !== null]);
    }

    private function pausar(string $telefone, bool $pausar): void
    {
        $conversa = StatusConversa::firstOrCreate(['telefone' => $telefone], ['status_atual' => 'transbordo_humano', 'rascunho' => []]);
        $conversa->update(['bot_pausado_ate' => $pausar ? now()->addHours(self::PAUSA_HORAS) : null]);
    }

    private function pausadoAte(string $telefone): ?string
    {
        $ate = StatusConversa::where('telefone', $telefone)->value('bot_pausado_ate');

        return $ate && now()->lt($ate) ? Carbon::parse($ate)->toIso8601String() : null;
    }

    private function validarTelefone(string $telefone): void
    {
        abort_unless(preg_match('/^\d{10,15}$/', $telefone), 404);
    }
}
