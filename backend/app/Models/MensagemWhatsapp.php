<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MensagemWhatsapp extends Model
{
    protected $table = 'mensagens_whatsapp';

    protected $fillable = [
        'direcao', 'telefone', 'wa_message_id', 'chave', 'tipo', 'texto', 'status', 'tentativas',
        'proxima_tentativa_em', 'erro', 'meta_message_id', 'processada_em', 'enviada_em', 'enviada_por',
    ];

    protected $casts = [
        'tentativas' => 'integer',
        'proxima_tentativa_em' => 'datetime',
        'processada_em' => 'datetime',
        'enviada_em' => 'datetime',
    ];
}
