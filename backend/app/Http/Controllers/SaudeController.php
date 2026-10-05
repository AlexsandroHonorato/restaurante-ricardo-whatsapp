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
}
