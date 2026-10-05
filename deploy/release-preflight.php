<?php

// Recusa publicar com .env de desenvolvimento: produção, sem debug, com APP_KEY, MySQL e token do bot.
require $argv[1].'/vendor/autoload.php';
$app = require $argv[1].'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (! $app->environment('production') || config('app.debug') || ! config('app.key')) {
    fwrite(STDERR, "Configure APP_ENV=production, APP_DEBUG=false e APP_KEY em shared/.env.\n");
    exit(1);
}
if (config('database.default') !== 'mysql') {
    fwrite(STDERR, "Esta distribuição requer MySQL.\n");
    exit(1);
}
if (strlen((string) config('services.bot.token')) < 32 || ! config('session.secure')) {
    fwrite(STDERR, "Configure NOTIFICACAO_TOKEN (mínimo 32 caracteres) e cookie de sessão seguro.\n");
    exit(1);
}
