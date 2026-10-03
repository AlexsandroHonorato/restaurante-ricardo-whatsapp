<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Atendimento extends Model
{
    use HasFactory;

    protected $table = 'atendimentos';

    protected $fillable = [
        'etapa_abandono',
        'cliente_id',
        'pedido_id',
        'inicio_em',
        'fim_em',
        'duracao_segundos',
        'status',
        'total_mensagens_cliente',
        'total_mensagens_bot',
        'transbordo_humano',
        'motivo_transbordo',
        'tokens_estimados',
        'canal',
    ];

    protected $casts = [
        'inicio_em' => 'datetime',
        'fim_em' => 'datetime',
        'duracao_segundos' => 'integer',
        'total_mensagens_cliente' => 'integer',
        'total_mensagens_bot' => 'integer',
        'transbordo_humano' => 'boolean',
        'tokens_estimados' => 'integer',
    ];

    public function cliente()
    {
        return $this->belongsTo(Cliente::class);
    }

    public function pedido()
    {
        return $this->belongsTo(Pedido::class);
    }
}
