<?php

namespace App\Http\Controllers;

use App\Support\SaudeSistema;
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
        // Monitores externos (UptimeRobot) também detectam o bot fora do ar por aqui.
        $bot = SaudeSistema::botNoAr() ? 'ok' : 'error';
        $saudavel = $banco === 'ok' && $bot === 'ok';

        return response()->json([
            'application' => 'BotClient',
            'status' => $saudavel ? 'healthy' : 'unhealthy',
            'database' => $banco,
            'bot' => $bot,
            'version' => is_array($manifesto) && is_string($manifesto['commit'] ?? null) ? $manifesto['commit'] : 'dev',
        ], $saudavel ? 200 : 503)->header('Cache-Control', 'no-store, private');
    }
}
