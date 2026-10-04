<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreUserRequest;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

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
}
