<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Models\Perfil;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/** As rotas já conferem a permissão do perfil (usuarios: ver, criar, editar, excluir). */
class UserController extends Controller
{
    public function index()
    {
        return response()->json(['data' => User::with('perfil:id,nome')->orderBy('name')->paginate(30)]);
    }

    public function store(StoreUserRequest $request)
    {
        $dados = $this->dadosDoPerfil($request->validated(), $request);
        $dados['email'] = Str::lower(trim($dados['email']));
        unset($dados['password_confirmation']);
        $user = User::create($dados);

        return response()->json(['user' => $user], 201);
    }

    public function update(UpdateUserRequest $request, int $id)
    {
        $user = User::findOrFail($id);
        $this->protegerAdministrador($user, $request);
        $dados = $this->dadosDoPerfil($request->validated(), $request);
        if (empty($dados['password'])) {
            unset($dados['password']);
        }

        // Ninguém muda o próprio perfil nem se desativa: um administrador não se rebaixa (sempre sobra ao menos um)
        // e quem não é administrador não escolhe para si um perfil com mais acesso.
        $padrao = Perfil::where('padrao', true)->value('id');
        $mudouPerfil = $dados['role'] !== $user->role || ($dados['perfil_id'] ?? $padrao) !== ($user->perfil_id ?? $padrao);
        if ($user->is($request->user()) && ($mudouPerfil || ! $dados['active'])) {
            throw ValidationException::withMessages(['role' => 'Você não pode desativar a própria conta nem trocar o próprio perfil.']);
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
        $user = User::findOrFail($id);
        $this->protegerAdministrador($user, $request);
        if ($user->is($request->user())) {
            throw ValidationException::withMessages(['usuario' => 'Você não pode excluir a própria conta.']);
        }
        $user->delete();
        // Histórico de pedidos e conversas guarda nome/e-mail em texto: nada fica órfão.
        $this->encerrarSessoes($user, $request);

        return response()->json(['ok' => true]);
    }

    /** Conta de administrador só é alterada ou excluída por outro administrador. */
    private function protegerAdministrador(User $user, Request $request): void
    {
        abort_if($user->ehAdmin() && ! $request->user()->ehAdmin(), 403, 'Somente administradores alteram a conta de um administrador.');
    }

    /**
     * Administrador não usa perfil; só um administrador pode criar outro.
     *
     * @param  array<string, mixed>  $dados
     * @return array<string, mixed>
     */
    private function dadosDoPerfil(array $dados, Request $request): array
    {
        abort_if($dados['role'] === 'admin' && ! $request->user()->ehAdmin(), 403, 'Somente administradores concedem o perfil Administrador.');
        $dados['perfil_id'] = $dados['role'] === 'admin' ? null : ($dados['perfil_id'] ?? null);

        return $dados;
    }

    private function encerrarSessoes(User $user, Request $request): void
    {
        // Em produção a sessão fica no banco (SESSION_DRIVER=database). A sessão de quem está editando a própria senha continua valendo.
        DB::table('sessions')->where('user_id', $user->id)
            ->when($user->is($request->user()), fn ($q) => $q->where('id', '!=', $request->session()->getId()))
            ->delete();
    }
}
