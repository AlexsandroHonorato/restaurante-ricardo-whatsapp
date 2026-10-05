<?php

namespace App\Support;

use App\Models\MensagemWhatsapp;
use Illuminate\Support\Facades\Http;

/** Problemas que exigem ação da equipe: usados pelo /api/health, pela faixa do painel e pelo alerta por e-mail. */
class SaudeSistema
{
    public static function botNoAr(): bool
    {
        try {
            return trim(Http::timeout(3)->get(rtrim((string) config('services.bot.url'), '/').'/')->body()) === 'agente no ar';
        } catch (\Throwable) {
            return false;
        }
    }

    /** @return list<array{codigo: string, mensagem: string}> */
    public static function problemas(): array
    {
        $problemas = [];
        $saidas = fn () => MensagemWhatsapp::where('direcao', 'saida');
        if (! self::botNoAr()) {
            $problemas[] = ['codigo' => 'bot_fora_do_ar', 'mensagem' => 'O bot do WhatsApp não está respondendo. Os clientes ficam sem resposta.'];
        }
        // Token recusado (expirado/inválido) e nenhum envio bem-sucedido depois disso.
        $falhaToken = $saidas()->where('erro', 'like', '%HTTP 401%')->where('updated_at', '>=', now()->subHours(2))->max('updated_at');
        $ultimoEnvio = $saidas()->where('status', 'enviada')->max('enviada_em');
        if ($falhaToken && (! $ultimoEnvio || $ultimoEnvio < $falhaToken)) {
            $problemas[] = ['codigo' => 'whatsapp_token', 'mensagem' => 'O WhatsApp recusou o token de acesso (expirado ou inválido). Gere um novo token na Meta e atualize o bot.'];
        }
        if ($falhas = $saidas()->where('status', 'falhou')->where('updated_at', '>=', now()->subDay())->count()) {
            $problemas[] = ['codigo' => 'envios_falharam', 'mensagem' => "{$falhas} mensagem(ns) não puderam ser enviadas nas últimas 24 horas."];
        }
        if ($atrasadas = $saidas()->where('status', 'pendente')->where('tentativas', '>', 0)->where('created_at', '<=', now()->subMinutes(10))->count()) {
            $problemas[] = ['codigo' => 'fila_atrasada', 'mensagem' => "{$atrasadas} mensagem(ns) aguardando reenvio há mais de 10 minutos."];
        }
        $paradas = MensagemWhatsapp::where('direcao', 'entrada')->whereIn('status', ['pendente', 'processando'])
            ->where('created_at', '<=', now()->subMinutes(5))->count();
        if ($paradas) {
            $problemas[] = ['codigo' => 'entradas_sem_resposta', 'mensagem' => "{$paradas} mensagem(ns) de clientes sem resposta há mais de 5 minutos."];
        }

        return $problemas;
    }
}
