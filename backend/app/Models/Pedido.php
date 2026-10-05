<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Pedido extends Model
{
    use HasFactory;

    protected $table = 'pedidos';

    protected $fillable = [
        'motivo_cancelamento',
        'codigo_pedido',
        'chave_idempotencia',
        'cliente_id',
        'endereco_id',
        'status',
        'forma_pagamento',
        'valor_subtotal',
        'taxa_entrega',
        'valor_desconto',
        'valor_total',
        'troco_para',
        'valor_troco',
        'tempo_estimado_min',
        'observacoes',
        'origem',
        'preparado_em',
        'saiu_entrega_em',
        'entregue_em',
        'cancelado_em',
        'comanda_impressa_em',
    ];

    protected $casts = [
        'valor_subtotal' => 'decimal:2',
        'taxa_entrega' => 'decimal:2',
        'valor_desconto' => 'decimal:2',
        'valor_total' => 'decimal:2',
        'troco_para' => 'decimal:2',
        'valor_troco' => 'decimal:2',
        'tempo_estimado_min' => 'integer',
        'preparado_em' => 'datetime',
        'saiu_entrega_em' => 'datetime',
        'entregue_em' => 'datetime',
        'cancelado_em' => 'datetime',
        'comanda_impressa_em' => 'datetime',
    ];

    public function cliente()
    {
        return $this->belongsTo(Cliente::class);
    }

    public function endereco()
    {
        return $this->belongsTo(Endereco::class);
    }

    public function itens()
    {
        return $this->hasMany(PedidoItem::class);
    }

    public function historicoStatus()
    {
        return $this->hasMany(HistoricoStatusPedido::class);
    }

    public function atendimento()
    {
        return $this->hasOne(Atendimento::class);
    }

    public function statusCatalogo()
    {
        return $this->belongsTo(StatusPedido::class, 'status', 'codigo');
    }
}
