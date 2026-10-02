<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProdutoVariacao extends Model
{
    use HasFactory;

    protected $table = 'produto_variacoes';

    protected $fillable = [
        'produto_id',
        'tamanho',
        'preco',
        'codigo_sku',
        'ativo',
    ];

    protected $casts = [
        'preco' => 'decimal:2',
        'ativo' => 'boolean',
    ];

    public function produto()
    {
        return $this->belongsTo(Produto::class);
    }
}
