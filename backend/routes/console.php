<?php

use App\Models\User;
use App\Support\PasswordPolicy;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Validator;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('app:criar-admin', function () {
    $nome = $this->ask('Nome completo');
    $email = strtolower(trim($this->ask('E-mail')));
    $senha = $this->secret('Senha (mínimo 8, maiúscula, minúscula, número e símbolo)');
    $confirmacao = $this->secret('Confirme a senha');
    $dados = ['name' => $nome, 'email' => $email, 'password' => $senha, 'password_confirmation' => $confirmacao];
    $validator = Validator::make($dados, [
        'name' => 'required|string|min:3|max:150',
        'email' => 'required|email|max:254|unique:users',
        'password' => PasswordPolicy::rules(),
    ]);
    if ($validator->fails()) {
        foreach ($validator->errors()->all() as $erro) {
            $this->error($erro);
        }

return 1;
    }
    User::create(['name' => $nome, 'email' => $email, 'password' => $senha, 'role' => 'admin', 'active' => true]);
    $this->info('Administrador criado. Faça login com o e-mail informado.');
})->purpose('Cria administrador com senha digitada de forma oculta');
