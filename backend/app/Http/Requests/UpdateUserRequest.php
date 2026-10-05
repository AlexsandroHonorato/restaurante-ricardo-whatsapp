<?php

namespace App\Http\Requests;

use App\Support\PasswordPolicy;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Edição de usuário: senha em branco mantém a atual. */
class UpdateUserRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge(['email' => strtolower(trim((string) $this->input('email'))), 'name' => trim((string) $this->input('name'))]);
    }

    public function authorize(): bool
    {
        return (bool) $this->user()?->active && $this->user()->pode('usuarios', 'editar');
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:3', 'max:150'],
            'email' => ['required', 'email:rfc', 'max:254', Rule::unique('users')->ignore((int) $this->route('id'))],
            'phone' => ['nullable', 'regex:/^[+0-9 ()-]{10,20}$/'],
            'role' => ['required', Rule::in(['admin', 'operador'])],
            'perfil_id' => ['nullable', 'integer', Rule::exists('perfis', 'id')],
            'active' => ['required', 'boolean'],
            'password' => $this->filled('password') ? PasswordPolicy::rules() : ['nullable'],
        ];
    }
}
