<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Conjunto de permissões (telas e ações) atribuído aos usuários que não são administradores. */
class Perfil extends Model
{
    protected $table = 'perfis';

    protected $fillable = ['nome', 'permissoes', 'padrao'];

    protected $casts = ['permissoes' => 'array', 'padrao' => 'boolean'];

    /** @return HasMany<User, $this> */
    public function usuarios(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
