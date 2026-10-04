<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function csrf(Request $request)
    {
        return response()->json(['csrf' => csrf_token()])->header('Cache-Control', 'no-store');
    }

    public function login(Request $request)
    {
        $dados = $request->validate(['email' => 'required|email|max:254', 'password' => 'required|string|max:128']);
        $email = Str::lower(trim($dados['email']));
        $chave = 'login:'.hash('sha256', $email.'|'.$request->ip());
        if (RateLimiter::tooManyAttempts($chave, 5)) {
            return response()->json(['message' => 'Muitas tentativas. Aguarde um minuto e tente novamente.'], 429)->header('Retry-After', RateLimiter::availableIn($chave));
        }
        $usuario = User::where('email', $email)->first();
        // Hash de comparação mantém trabalho de verificação mesmo para e-mail inexistente.
        $hash = $usuario?->password ?? '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';
        if (! Hash::check($dados['password'], $hash) || ! $usuario?->active) {
            RateLimiter::hit($chave, 60);

            return response()->json(['message' => 'E-mail ou senha inválidos.'], 422);
        }
        RateLimiter::clear($chave);
        Auth::login($usuario);
        $request->session()->regenerate();

        return response()->json(['user' => $usuario, 'csrf' => csrf_token()])->header('Cache-Control', 'no-store');
    }

    public function me(Request $request)
    {
        return response()->json(['user' => $request->user()])->header('Cache-Control', 'no-store');
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['ok' => true]);
    }
}
