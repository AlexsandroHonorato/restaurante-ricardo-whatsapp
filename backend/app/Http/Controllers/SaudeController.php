<?php

namespace App\Http\Controllers;

use App\Support\SaudeSistema;
use Illuminate\Http\JsonResponse;

class SaudeController extends Controller
{
    /** Faixa de avisos do painel: problemas que a equipe precisa resolver agora. */
    public function __invoke(): JsonResponse
    {
        $problemas = SaudeSistema::problemas();

        return response()->json([
            'status' => $problemas ? 'atencao' : 'ok',
            'problemas' => $problemas,
            'verificado_em' => now()->toIso8601String(),
        ]);
    }

    /** Mensagens de um aviso, para a equipe abrir a conversa de cada uma. */
    public function detalhes(string $codigo): JsonResponse
    {
        $mensagens = SaudeSistema::detalhes($codigo);
        abort_if($mensagens === null, 404);

        return response()->json($mensagens);
    }

    /** Tira do aviso uma mensagem (com id) ou todas as mensagens dele. */
    public function dispensar(string $codigo, ?int $id = null): JsonResponse
    {
        $dispensadas = SaudeSistema::dispensar($codigo, $id);
        abort_if($dispensadas === null || ($id && $dispensadas === 0), 404);

        return response()->json(['dispensadas' => $dispensadas]);
    }
}
