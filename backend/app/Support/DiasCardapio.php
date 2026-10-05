<?php

namespace App\Support;

use Illuminate\Support\Str;

/**
 * Interpreta produtos.dias_disponiveis ("todos", "quarta,sabado" ou abreviações legadas "qua,sab")
 * no fuso do restaurante. Mesma regra do painel (frontend/src/app/core/models/dias-cardapio.ts).
 */
class DiasCardapio
{
    private const DIAS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];

    private const NOMES = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];

    private const ABREVIACOES = ['seg' => 'segunda', 'ter' => 'terca', 'qua' => 'quarta', 'qui' => 'quinta', 'sex' => 'sexta', 'sab' => 'sabado', 'dom' => 'domingo'];

    /** @return list<string> dias normalizados, em ordem de segunda a domingo */
    public static function dias(?string $valor): array
    {
        if (! $valor || $valor === 'todos') {
            return self::DIAS;
        }
        $informados = array_map(function (string $dia) {
            $dia = Str::lower(Str::ascii(trim($dia)));

            return self::ABREVIACOES[$dia] ?? $dia;
        }, explode(',', $valor));

        return array_values(array_filter(self::DIAS, fn ($dia) => in_array($dia, $informados, true)));
    }

    public static function disponivelHoje(?string $valor): bool
    {
        $hoje = self::DIAS[now(config('app.timezone_negocio', 'America/Sao_Paulo'))->dayOfWeekIso - 1];

        return in_array($hoje, self::dias($valor), true);
    }

    public static function descrever(?string $valor): string
    {
        return implode(', ', array_map(fn ($dia) => self::NOMES[array_search($dia, self::DIAS, true)], self::dias($valor)));
    }
}
