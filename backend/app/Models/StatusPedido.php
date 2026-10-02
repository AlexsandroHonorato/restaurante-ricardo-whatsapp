<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StatusPedido extends Model
{
    use HasFactory;

    protected $table = 'status_pedidos';

    protected $fillable = [
        'codigo',
        'nome',
        'descricao',
        'cor_badge',
        'icone',
        'ordem',
        'ativo',
    ];

    protected $casts = [
        'ativo' => 'boolean',
        'ordem' => 'integer',
    ];

    /**
     * Relacionamento com os pedidos que possuem este status (pelo código)
     */
    public function pedidos()
    {
        return $this->hasMany(Pedido::class, 'status', 'codigo');
    }
}
