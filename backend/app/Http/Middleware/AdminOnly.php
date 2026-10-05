<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/** Cardápio, preços, horários e usuários: só administrador altera. */
class AdminOnly
{
    public function handle(Request $request, Closure $next)
    {
        abort_unless($request->user()?->role === 'admin', 403, 'Somente administradores podem fazer esta alteração.');

        return $next($request);
    }
}
