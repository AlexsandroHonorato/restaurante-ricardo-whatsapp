<?php

namespace App\Support;

use App\Models\MensagemWhatsapp;
use Illuminate\Support\Collection;

/**
 * Clientes que escreveram com o bot fora do ar e não foram respondidos: a mensagem chegou tarde demais
 * (status "ignorada") e ninguém, nem o bot nem a equipe, falou com o cliente depois dela.
 */
class ClientesSemResposta
{
    private const HORAS = 24;

    /** @return Collection<int, array{telefone: string, quantidade: int, ultima_mensagem: ?string, ultima_em: mixed}> */
    public static function lista(): Collection
    {
        return MensagemWhatsapp::where('direcao', 'entrada')->where('status', 'ignorada')
            ->where('created_at', '>=', now()->subHours(self::HORAS))->orderBy('id')
            ->get(['id', 'telefone', 'texto', 'created_at'])->groupBy('telefone')
            ->reject(fn (Collection $mensagens, string $telefone) => MensagemWhatsapp::where('direcao', 'saida')
                ->where('telefone', $telefone)->where('id', '>', $mensagens->last()->id)->exists())
            ->map(fn (Collection $mensagens, string $telefone) => [
                'telefone' => $telefone,
                'quantidade' => $mensagens->count(),
                'ultima_mensagem' => $mensagens->last()->texto,
                'ultima_em' => $mensagens->last()->created_at,
            ])->values();
    }

    /** A equipe viu o aviso e decidiu não chamar: as mensagens voltam a ser histórico comum. */
    public static function dispensar(string $telefone): void
    {
        MensagemWhatsapp::where('direcao', 'entrada')->where('status', 'ignorada')->where('telefone', $telefone)
            ->update(['status' => 'processada']);
    }
}
