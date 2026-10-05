<?php

namespace App\Http\Requests;

use App\Support\PasswordPolicy;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreUserRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge(['email' => strtolower(trim((string) $this->input('email'))), 'name' => trim((string) $this->input('name'))]);
    }

    public function authorize(): bool
    {
        return (bool) $this->user()?->active && $this->user()->pode('usuarios', 'criar');
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:3', 'max:150'],
            'email' => ['required', 'email:rfc', 'max:254', Rule::unique('users')],
            'phone' => ['nullable', 'regex:/^[+0-9 ()-]{10,20}$/'],
            // admin = perfil fixo Administrador; operador = segue o perfil escolhido (sem escolha, o padrão).
            'role' => ['required', Rule::in(['admin', 'operador'])],
            'perfil_id' => ['nullable', 'integer', Rule::exists('perfis', 'id')],
            'active' => ['required', 'boolean'],
            'password' => PasswordPolicy::rules(),
        ];
    }
}
