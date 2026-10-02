<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StatusConversa extends Model
{
    use HasFactory;

    protected $table = 'status_conversas';

    protected $fillable = [
        'telefone',
        'status_atual',
        'status_anterior',
        'rascunho',
        'ultimo_contato_em',
        'expira_em',
    ];

    protected $casts = [
        'rascunho' => 'array',
        'ultimo_contato_em' => 'datetime',
        'expira_em' => 'datetime',
    ];
}
