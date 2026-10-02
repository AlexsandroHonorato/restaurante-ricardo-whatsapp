<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Cliente extends Model
{
    use HasFactory;

    protected $table = 'clientes';

    protected $fillable = [
        'telefone',
        'nome',
        'primeiro_contato_em',
        'ultimo_contato_em',
        'total_pedidos',
        'total_gasto',
        'ativo',
    ];

    protected $casts = [
        'primeiro_contato_em' => 'datetime',
        'ultimo_contato_em' => 'datetime',
        'total_pedidos' => 'integer',
        'total_gasto' => 'decimal:2',
        'ativo' => 'boolean',
    ];

    public function enderecos()
    {
        return $this->hasMany(Endereco::class);
    }

    public function pedidos()
    {
        return $this->hasMany(Pedido::class);
    }

    public function atendimentos()
    {
        return $this->hasMany(Atendimento::class);
    }
}
