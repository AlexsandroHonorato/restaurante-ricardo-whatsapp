<?php

namespace App\Http\Controllers;

use App\Models\MensagemWhatsapp;
use App\Models\Pedido;
use App\Models\StatusConversa;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Rotas internas do bot (BotAccess): caixa de entrada/saída durável e estado da conversa. */
class BotMensagemController extends Controller
{
    /** Intervalo antes de cada nova tentativa de envio; esgotada a lista, a mensagem fica como falhou. */
    private const ESPERA_SEGUNDOS = [30, 120, 600, 1800, 7200];

    private const HISTORICO = 20;

    public function registrarEntrada(Request $request): JsonResponse
    {
        $dados = $request->validate([
            'wa_message_id' => 'required|string|max:150',
            'telefone' => ['required', 'regex:/^\d{10,15}$/'],
            'tipo' => 'required|string|max:20',
            'texto' => 'nullable|string|max:4096',
        ]);
        $mensagem = MensagemWhatsapp::firstOrCreate(
            ['wa_message_id' => $dados['wa_message_id']],
            ['direcao' => 'entrada', 'telefone' => $dados['telefone'], 'tipo' => $dados['tipo'], 'texto' => $dados['texto'] ?? null, 'status' => 'pendente'],
        );

        return response()->json(['mensagem' => $mensagem, 'duplicada' => ! $mensagem->wasRecentlyCreated], $mensagem->wasRecentlyCreated ? 201 : 200);
    }

    public function criarSaida(Request $request): JsonResponse
    {
        $dados = $request->validate([
            'telefone' => ['required', 'regex:/^\d{10,15}$/'],
            'texto' => 'required|string|max:4096',
            'chave' => 'required|string|max:150',
        ]);
        // O fluxo principal envia na hora; o reenvio em segundo plano só entra se isso não terminar em 30s.
        $mensagem = MensagemWhatsapp::firstOrCreate(
            ['chave' => $dados['chave']],
            ['direcao' => 'saida', 'telefone' => $dados['telefone'], 'texto' => $dados['texto'], 'status' => 'pendente', 'proxima_tentativa_em' => now()->addSeconds(30)],
        );

        return response()->json(['mensagem' => $mensagem], $mensagem->wasRecentlyCreated ? 201 : 200);
    }

    public function atualizar(Request $request, int $id): JsonResponse
    {
        $dados = $request->validate([
            'status' => 'required|in:processando,processada,enviada,pendente',
            'erro' => 'nullable|string|max:255',
            'meta_message_id' => 'nullable|string|max:150',
        ]);
        $mensagem = MensagemWhatsapp::findOrFail($id);
        $mensagem->fill(['status' => $dados['status'], 'erro' => $dados['erro'] ?? null]);
        match ($dados['status']) {
            'processada' => $mensagem->processada_em = now(),
            'enviada' => $mensagem->fill(['enviada_em' => now(), 'meta_message_id' => $dados['meta_message_id'] ?? null, 'proxima_tentativa_em' => null]),
            // Falha de envio: reagenda com espera crescente ou desiste.
            'pendente' => $this->reagendar($mensagem),
            default => null,
        };
        $mensagem->save();

        return response()->json(['mensagem' => $mensagem]);
    }

    private function reagendar(MensagemWhatsapp $mensagem): void
    {
        $mensagem->tentativas++;
        if ($mensagem->tentativas > count(self::ESPERA_SEGUNDOS)) {
            $mensagem->fill(['status' => 'falhou', 'proxima_tentativa_em' => null]);

            return;
        }
        $mensagem->proxima_tentativa_em = now()->addSeconds(self::ESPERA_SEGUNDOS[$mensagem->tentativas - 1]);
    }

    /** O que o bot deve retomar: entradas paradas há mais de 1 minuto e saídas com reenvio vencido. */
    public function pendentes(): JsonResponse
    {
        $entradas = MensagemWhatsapp::where('direcao', 'entrada')->whereIn('status', ['pendente', 'processando'])
            ->where('updated_at', '<=', now()->subMinute())->orderBy('id')->limit(20)->get()
            ->map(fn ($m) => [...$m->toArray(), 'respondida' => MensagemWhatsapp::where('chave', 'resp:'.$m->wa_message_id)->exists()]);
        $saidas = MensagemWhatsapp::where('direcao', 'saida')->where('status', 'pendente')
            ->where('proxima_tentativa_em', '<=', now())->orderBy('id')->limit(20)->get();

        return response()->json(['entradas' => $entradas, 'saidas' => $saidas]);
    }

    /** Estado, últimas mensagens e último pedido: o bot recarrega a conversa daqui após reiniciar. */
    public function conversa(string $telefone): JsonResponse
    {
        abort_unless(preg_match('/^\d{10,15}$/', $telefone), 404);
        $estado = StatusConversa::where('telefone', $telefone)->first();
        $historico = MensagemWhatsapp::where('telefone', $telefone)
            ->where(fn ($q) => $q->where('direcao', 'saida')->orWhere('status', 'processada'))
            ->whereNotNull('texto')->orderByDesc('id')->limit(self::HISTORICO)->get()->reverse()
            ->map(fn ($m) => ['role' => $m->direcao === 'entrada' ? 'user' : 'assistant', 'content' => $m->texto])->values();
        $pedido = Pedido::with('cliente')->whereHas('cliente', fn ($q) => $q->where('telefone', $telefone))->latest('id')->first();

        return response()->json([
            'status' => $estado?->status_atual,
            'rascunho' => $estado?->rascunho,
            'ultimo_contato_em' => $estado?->ultimo_contato_em,
            'historico' => $historico,
            'ultimo_pedido' => $pedido ? [
                'codigo_pedido' => $pedido->codigo_pedido, 'status' => $pedido->status,
                'created_at' => $pedido->created_at, 'nome' => $pedido->cliente?->nome,
            ] : null,
        ]);
    }
}
