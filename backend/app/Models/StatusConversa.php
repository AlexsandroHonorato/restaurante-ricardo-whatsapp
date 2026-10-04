<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StatusConversa extends Model
{
    use HasFactory;

    protected $table = 'status_conversas';

    protected $fillable = [
        'contato_iniciado_em',
        'telefone',
        'status_atual',
        'status_anterior',
        'rascunho',
        'ultimo_contato_em',
        'expira_em',
    ];

    protected $casts = [
        'contato_iniciado_em' => 'datetime',
        'rascunho' => 'array',
        'ultimo_contato_em' => 'datetime',
        'expira_em' => 'datetime',
    ];
}
