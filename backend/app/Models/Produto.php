<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Produto extends Model
{
    use HasFactory;

    protected $table = 'produtos';

    protected $fillable = [
        'categoria_id',
        'tipo',
        'nome',
        'descricao',
        'dias_disponiveis',
        'ativo',
    ];

    protected $casts = [
        'ativo' => 'boolean',
    ];

    public function categoria()
    {
        return $this->belongsTo(Categoria::class);
    }

    public function variacoes()
    {
        return $this->hasMany(ProdutoVariacao::class);
    }

    public function pedidoItens()
    {
        return $this->hasMany(PedidoItem::class);
    }
}
