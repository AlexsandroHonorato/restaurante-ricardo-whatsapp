<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Categoria extends Model
{
    use HasFactory;

    protected $table = 'categorias';

    protected $fillable = [
        'nome',
        'slug',
        'descricao',
        'ordem_exibicao',
        'ativo',
    ];

    protected $casts = [
        'ordem_exibicao' => 'integer',
        'ativo' => 'boolean',
    ];

    public function produtos()
    {
        return $this->hasMany(Produto::class);
    }
}
