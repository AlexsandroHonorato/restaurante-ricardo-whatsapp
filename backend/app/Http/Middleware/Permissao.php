<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/** Confere no servidor a permissão do perfil: Permissao::class.':pedidos,editar'. Esconder botão no painel não protege. */
class Permissao
{
    public function handle(Request $request, Closure $next, string $tela, string $acao)
    {
        abort_unless($request->user()?->pode($tela, $acao), 403, 'Seu perfil não tem permissão para esta ação.');

        return $next($request);
    }
}
