<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/** Agente de impressão da cozinha: token próprio, só alcança as rotas /impressora (sem token configurado, fechado). */
class ImpressoraAccess
{
    public function handle(Request $request, Closure $next)
    {
        $token = config('services.impressora.token');
        abort_unless(is_string($token) && strlen($token) >= 32 && hash_equals($token, $request->bearerToken() ?? ''), 401, 'Acesso não autorizado.');

        return $next($request);
    }
}
