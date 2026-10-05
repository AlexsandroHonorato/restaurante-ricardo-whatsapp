<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Empresa extends Model
{
    protected $table = 'empresa';

    public const TIPOS = ['restaurante', 'loja'];

    protected $fillable = ['nome', 'tipo_negocio', 'telefone', 'telefone_2', 'endereco', 'quem_somos', 'formas_pagamento', 'politicas'];

    /** Única ficha desta instalação (cada empresa tem a própria instalação do BotClient). */
    public static function atual(): self
    {
        return self::firstOrCreate(['id' => 1]);
    }

    /** Nome para mensagens: o cadastrado no painel ou, se vazio, o do .env. */
    public static function nomeExibicao(): string
    {
        return self::atual()->nome ?: (string) config('services.empresa.nome');
    }
}
