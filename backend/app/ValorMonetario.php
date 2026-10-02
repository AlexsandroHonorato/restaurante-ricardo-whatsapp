<?php

namespace App;

use Illuminate\Validation\ValidationException;

class ValorMonetario
{
    public static function centavos(mixed $valor, string $campo = 'total'): int
    {
        $texto = preg_replace('/R\$|\s/u', '', (string) $valor);
        if (str_contains($texto, ',')) {
            $texto = str_replace('.', '', $texto);
            $texto = str_replace(',', '.', $texto);
        }
        if (! preg_match('/^\d+(?:\.\d{1,2})?$/', $texto)) {
            throw ValidationException::withMessages([$campo => 'Valor monetário inválido.']);
        }
        $partes = explode('.', $texto);
        $centavos = (int) $partes[0] * 100 + (int) str_pad($partes[1] ?? '', 2, '0');
        if ($centavos > 9999999999) {
            throw ValidationException::withMessages([$campo => 'Valor acima do limite.']);
        }

        return $centavos;
    }
}
