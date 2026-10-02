<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Endereco extends Model
{
    use HasFactory;

    protected $table = 'enderecos';

    protected $fillable = [
        'cliente_id',
        'logradouro',
        'numero',
        'bairro',
        'complemento',
        'ponto_referencia',
        'cep',
        'cidade',
        'estado',
        'padrao',
    ];

    protected $casts = [
        'padrao' => 'boolean',
    ];

    public function cliente()
    {
        return $this->belongsTo(Cliente::class);
    }

    public function pedidos()
    {
        return $this->hasMany(Pedido::class);
    }
}
