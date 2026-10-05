<?php

namespace App\Support;

use App\Models\MensagemWhatsapp;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
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

    /** @return list<array{codigo: string, mensagem: string, detalhes?: bool}> */
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
        // "detalhes": o painel pode listar as mensagens deste aviso (GET /sistema/saude/{codigo}).
        if ($falhas = self::mensagens('envios_falharam')->count()) {
            $problemas[] = ['codigo' => 'envios_falharam', 'mensagem' => "{$falhas} mensagem(ns) não puderam ser enviadas nas últimas 24 horas.", 'detalhes' => true];
        }
        if ($atrasadas = self::mensagens('fila_atrasada')->count()) {
            $problemas[] = ['codigo' => 'fila_atrasada', 'mensagem' => "{$atrasadas} mensagem(ns) aguardando reenvio há mais de 10 minutos.", 'detalhes' => true];
        }
        if ($paradas = self::mensagens('entradas_sem_resposta')->count()) {
            $problemas[] = ['codigo' => 'entradas_sem_resposta', 'mensagem' => "{$paradas} mensagem(ns) de clientes sem resposta há mais de 5 minutos.", 'detalhes' => true];
        }
        if ($semResposta = ClientesSemResposta::lista()->count()) {
            $problemas[] = ['codigo' => 'clientes_sem_resposta', 'mensagem' => "{$semResposta} cliente(s) escreveram com o bot fora do ar e ficaram sem resposta. Veja em Atendimentos.", 'detalhes' => true];
        }

        return $problemas;
    }

    /** Mensagens por trás de um aviso; null quando o aviso não é sobre mensagens (bot fora do ar, token). */
    private static function mensagens(string $codigo): ?Builder
    {
        $saidas = fn () => MensagemWhatsapp::where('direcao', 'saida');
        $entradas = fn () => MensagemWhatsapp::where('direcao', 'entrada');

        return match ($codigo) {
            // Resolvida quando alguma mensagem posterior chegou ao mesmo cliente (a equipe ou o bot falou com ele).
            'envios_falharam' => $saidas()->where('status', 'falhou')->where('updated_at', '>=', now()->subDay())
                ->whereNotExists(fn ($depois) => $depois->selectRaw('1')->from('mensagens_whatsapp as depois')
                    ->whereColumn('depois.telefone', 'mensagens_whatsapp.telefone')->whereColumn('depois.id', '>', 'mensagens_whatsapp.id')
                    ->where('depois.direcao', 'saida')->where('depois.status', 'enviada')),
            'fila_atrasada' => $saidas()->where('status', 'pendente')->where('tentativas', '>', 0)->where('created_at', '<=', now()->subMinutes(10)),
            'entradas_sem_resposta' => $entradas()->whereIn('status', ['pendente', 'processando'])->where('created_at', '<=', now()->subMinutes(5)),
            'clientes_sem_resposta' => $entradas()->where('status', 'ignorada')->where('created_at', '>=', now()->subDay())
                ->whereIn('telefone', ClientesSemResposta::lista()->pluck('telefone')),
            default => null,
        };
    }

    /**
     * Lista para o painel abrir a conversa certa: as 50 mensagens mais recentes do aviso.
     *
     * @return Collection<int, MensagemWhatsapp>|null
     */
    public static function detalhes(string $codigo): ?Collection
    {
        return self::mensagens($codigo)?->orderByDesc('id')->limit(50)->get(['id', 'direcao', 'telefone', 'texto', 'status', 'erro', 'created_at']);
    }
}
