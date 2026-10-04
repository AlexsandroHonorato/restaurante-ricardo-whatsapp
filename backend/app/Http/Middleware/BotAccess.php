<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class BotAccess
{
    public function handle(Request $request, Closure $next)
    {
        $token = config('services.bot.token');
        abort_unless(is_string($token) && strlen($token) >= 32 && hash_equals($token, $request->bearerToken() ?? ''), 401, 'Acesso não autorizado.');

        return $next($request);
    }
}
