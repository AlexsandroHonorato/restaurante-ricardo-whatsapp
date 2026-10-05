<?php

namespace App\Http\Controllers;

use App\Models\Perfil;
use App\Support\Permissoes;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** Perfis de usuário (Configurações): só o administrador cria, edita e exclui. */
class PerfilController extends Controller
{
    /** Lista com quantos usuários cada perfil tem e o catálogo de telas/ações para montar a grade. */
    public function index(): JsonResponse
    {
        return response()->json([
            'perfis' => Perfil::withCount('usuarios')->orderByDesc('padrao')->orderBy('nome')->get(),
            'telas' => Permissoes::TELAS,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(['perfil' => Perfil::create($this->validar($request))], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $perfil = Perfil::findOrFail($id);
        $perfil->update($this->validar($request, $perfil));

        return response()->json(['perfil' => $perfil]);
    }

    public function destroy(int $id): JsonResponse
    {
        $perfil = Perfil::withCount('usuarios')->findOrFail($id);
        if ($perfil->padrao) {
            throw ValidationException::withMessages(['perfil' => 'O perfil padrão não pode ser excluído.']);
        }
        if ($perfil->usuarios_count) {
            throw ValidationException::withMessages(['perfil' => "Há {$perfil->usuarios_count} usuário(s) com este perfil. Troque o perfil deles antes de excluir."]);
        }
        $perfil->delete();

        return response()->json(['ok' => true]);
    }

    /** @return array{nome: string, permissoes: array<string, list<string>>} */
    private function validar(Request $request, ?Perfil $perfil = null): array
    {
        $dados = $request->validate([
            'nome' => ['required', 'string', 'min:2', 'max:60', Rule::unique('perfis')->ignore($perfil?->id), Rule::notIn(['Administrador', 'administrador'])],
            'permissoes' => ['present', 'array'],
        ], ['nome.not_in' => 'Administrador é o perfil fixo do sistema; escolha outro nome.']);
        $permissoes = Permissoes::normalizar($dados['permissoes']);
        if (! $permissoes) {
            throw ValidationException::withMessages(['permissoes' => 'Marque ao menos uma tela para o perfil.']);
        }

        return ['nome' => trim($dados['nome']), 'permissoes' => $permissoes];
    }
}
