<?php

namespace App\Console\Commands;

use App\Mail\AlertaSaude;
use App\Support\SaudeSistema;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;

/** Agendado a cada 5 minutos: avisa por e-mail quando surge um conjunto novo de problemas (não repete o mesmo). */
class VerificarSaude extends Command
{
    protected $signature = 'botclient:verificar-saude';

    protected $description = 'Verifica bot, WhatsApp e filas de mensagens e alerta por e-mail';

    public function handle(): int
    {
        $problemas = SaudeSistema::problemas();
        // Pelo código (não pelo texto com contagens): mudar de 3 para 4 mensagens não gera outro e-mail.
        $assinatura = implode(',', array_column($problemas, 'codigo'));
        $anterior = Cache::get('saude.alerta_enviado');
        Cache::forever('saude.alerta_enviado', $assinatura);
        $destino = config('services.alertas.email');
        if (! $problemas || $assinatura === $anterior || ! $destino) {
            return self::SUCCESS;
        }
        Mail::to($destino)->send(new AlertaSaude($problemas));
        $this->warn('Alerta enviado: '.$assinatura);

        return self::SUCCESS;
    }
}
