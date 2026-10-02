<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PedidoItemAdicional extends Model
{
    use HasFactory;

    protected $table = 'pedido_item_adicionais';

    protected $fillable = [
        'pedido_item_id',
        'produto_id',
        'nome_snapshot',
        'quantidade',
        'preco_unitario',
        'subtotal',
    ];

    protected $casts = [
        'quantidade' => 'integer',
        'preco_unitario' => 'decimal:2',
        'subtotal' => 'decimal:2',
    ];

    public function pedidoItem()
    {
        return $this->belongsTo(PedidoItem::class);
    }

    public function produto()
    {
        return $this->belongsTo(Produto::class);
    }
}
