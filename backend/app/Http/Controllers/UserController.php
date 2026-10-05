<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()->role === 'admin', 403);

        return response()->json(['data' => User::orderBy('name')->paginate(30)]);
    }

    public function store(StoreUserRequest $request)
    {
        $dados = $request->validated();
        $dados['email'] = Str::lower(trim($dados['email']));
        unset($dados['password_confirmation']);
        $user = User::create($dados);

        return response()->json(['user' => $user], 201);
    }

    public function update(UpdateUserRequest $request, int $id)
    {
        $dados = $request->validated();
        if (empty($dados['password'])) {
            unset($dados['password']);
        }

        // Quem edita é um admin ativo e não pode se rebaixar/desativar/excluir: sempre sobra ao menos um admin.
        $user = User::findOrFail($id);
        if ($user->is($request->user()) && ! ($dados['role'] === 'admin' && $dados['active'])) {
            throw ValidationException::withMessages(['role' => 'Você não pode desativar nem rebaixar a própria conta.']);
        }
        $user->update($dados);
        // Senha trocada ou acesso retirado: encerra as sessões abertas dessa pessoa.
        if (isset($dados['password']) || ! $user->active) {
            $this->encerrarSessoes($user, $request);
        }

        return response()->json(['user' => $user->fresh()]);
    }

    public function destroy(Request $request, int $id)
    {
        abort_unless($request->user()?->role === 'admin', 403);
        $user = User::findOrFail($id);
        if ($user->is($request->user())) {
            throw ValidationException::withMessages(['usuario' => 'Você não pode excluir a própria conta.']);
        }
        $user->delete();
        // Histórico de pedidos e conversas guarda nome/e-mail em texto: nada fica órfão.
        $this->encerrarSessoes($user, $request);

        return response()->json(['ok' => true]);
    }

    private function encerrarSessoes(User $user, Request $request): void
    {
        // Em produção a sessão fica no banco (SESSION_DRIVER=database). A sessão de quem está editando a própria senha continua valendo.
        DB::table('sessions')->where('user_id', $user->id)
            ->when($user->is($request->user()), fn ($q) => $q->where('id', '!=', $request->session()->getId()))
            ->delete();
    }
}
