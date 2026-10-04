<?php

namespace App\Support;

use Illuminate\Validation\Rules\Password;

class PasswordPolicy
{
    public static function rules(): array
    {
        return ['required', 'string', 'confirmed', 'max:72', Password::min(8)->mixedCase()->numbers()->symbols(),
            function ($attribute, $value, $fail) {
                if (is_string($value) && strlen($value) > 72) {
                    $fail('A senha deve ter no máximo 72 bytes.');
                }
            }];
    }
}
