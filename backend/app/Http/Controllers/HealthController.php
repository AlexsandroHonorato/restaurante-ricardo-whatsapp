<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class HealthController extends Controller
{
    /**
     * Usado pelo deploy para confirmar que a versão publicada (SHA do pacote) está no ar com banco acessível.
     * Não expõe mensagens de erro: só estado e versão.
     */
    public function __invoke(): JsonResponse
    {
        try {
            DB::connection()->getPdo();
            $banco = 'ok';
        } catch (\Throwable) {
            $banco = 'error';
        }

        $manifesto = json_decode((string) @file_get_contents(base_path('version.json')), true);

        return response()->json([
            'application' => 'BotClient',
            'status' => $banco === 'ok' ? 'healthy' : 'unhealthy',
            'database' => $banco,
            'version' => is_array($manifesto) && is_string($manifesto['commit'] ?? null) ? $manifesto['commit'] : 'dev',
        ], $banco === 'ok' ? 200 : 503)->header('Cache-Control', 'no-store, private');
    }
}
