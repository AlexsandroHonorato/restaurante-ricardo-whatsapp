<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HistoricoStatusPedido extends Model
{
    use HasFactory;

    protected $table = 'historico_status_pedidos';

    protected $fillable = [
        'pedido_id',
        'status_anterior',
        'status_novo',
        'alterado_em',
        'alterado_por',
        'observacao',
    ];

    protected $casts = [
        'alterado_em' => 'datetime',
    ];

    public function pedido()
    {
        return $this->belongsTo(Pedido::class);
    }
}
