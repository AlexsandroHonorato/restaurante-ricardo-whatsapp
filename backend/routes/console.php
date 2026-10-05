<?php

use App\Models\User;
use App\Support\PasswordPolicy;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schedule;
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

// database/schema.sql é só referência: a fonte é migrations. Regerar depois de cada migration (MySQL).
Artisan::command('botclient:exportar-schema', function () {
    $tabelas = collect(DB::select("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'"))->map(fn ($t) => array_values((array) $t)[0])->sort();
    $sql = "-- Estrutura do banco gerada das migrations Laravel por `php artisan botclient:exportar-schema`.\n"
        ."-- NÃO edite à mão nem aplique em produção: o banco é criado com `php artisan migrate`.\n\n";
    foreach ($tabelas as $tabela) {
        $ddl = array_values((array) DB::selectOne("SHOW CREATE TABLE `{$tabela}`"))[1];
        $sql .= preg_replace('/ AUTO_INCREMENT=\d+/', '', $ddl).";\n\n";
    }
    file_put_contents(base_path('../database/schema.sql'), $sql);
    $this->info(count($tabelas).' tabelas exportadas para database/schema.sql');
})->purpose('Atualiza database/schema.sql com a estrutura atual do banco (referência)');

// Alerta por e-mail quando bot, WhatsApp ou filas de mensagens precisam de atenção (cron: schedule:run).
Schedule::command('botclient:verificar-saude')->everyFiveMinutes()->withoutOverlapping();

// LGPD: conversas antigas e clientes inativos (prazos em config/services.php).
Schedule::command('botclient:aplicar-retencao')->dailyAt('03:30')->withoutOverlapping();
