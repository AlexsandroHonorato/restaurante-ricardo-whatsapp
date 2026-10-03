<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HorarioAtendimento extends Model
{
    protected $table = 'horarios_atendimento';

    protected $fillable = ['dia_semana', 'ativo', 'hora_inicio', 'hora_fim'];

    protected $casts = ['dia_semana' => 'integer', 'ativo' => 'boolean'];

    protected $appends = ['nome_dia'];

    public function getNomeDiaAttribute(): string
    {
        return [1 => 'Segunda-feira', 2 => 'Terça-feira', 3 => 'Quarta-feira', 4 => 'Quinta-feira', 5 => 'Sexta-feira', 6 => 'Sábado', 7 => 'Domingo'][$this->dia_semana] ?? '';
    }
}
