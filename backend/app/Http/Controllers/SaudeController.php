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
}
