<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Support\Permissoes;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'password', 'phone', 'role', 'active', 'perfil_id'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'active' => 'boolean',
        ];
    }

    /** @return BelongsTo<Perfil, $this> */
    public function perfil(): BelongsTo
    {
        return $this->belongsTo(Perfil::class);
    }

    public function ehAdmin(): bool
    {
        return $this->role === 'admin';
    }

    /** Perfil em vigor: o escolhido ou, sem escolha, o padrão. Administrador não usa perfil. */
    public function perfilEmVigor(): ?Perfil
    {
        return $this->ehAdmin() ? null : ($this->perfil ?? Perfil::where('padrao', true)->first());
    }

    /**
     * Telas e ações liberadas. Administrador tem o catálogo inteiro.
     *
     * @return array<string, list<string>>
     */
    public function permissoes(): array
    {
        return $this->ehAdmin() ? Permissoes::TELAS : Permissoes::normalizar($this->perfilEmVigor()?->permissoes ?? []);
    }

    public function pode(string $tela, string $acao): bool
    {
        return in_array($acao, $this->permissoes()[$tela] ?? [], true);
    }

    /**
     * Usuário como o painel recebe no login: dados, nome do perfil e permissões.
     *
     * @return array<string, mixed>
     */
    public function paraSessao(): array
    {
        return [
            ...$this->only(['id', 'name', 'email', 'phone', 'role', 'active', 'perfil_id']),
            'perfil_nome' => $this->ehAdmin() ? 'Administrador' : ($this->perfilEmVigor()?->nome ?? 'Sem perfil'),
            'permissoes' => $this->permissoes(),
        ];
    }
}
