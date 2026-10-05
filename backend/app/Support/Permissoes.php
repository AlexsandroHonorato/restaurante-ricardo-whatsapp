<?php

namespace App\Support;

/**
 * Catálogo de permissões do painel: telas e as ações que existem em cada uma.
 * Ações que não são cadastro (mudar status do pedido, responder cliente, pausar prato) contam como "editar".
 */
class Permissoes
{
    /** @var array<string, list<string>> */
    public const TELAS = [
        'dashboard' => ['ver'],
        'pedidos' => ['ver', 'editar', 'excluir'],
        'atendimentos' => ['ver', 'editar', 'excluir'],
        'clientes' => ['ver', 'excluir'],
        'cardapio' => ['ver', 'criar', 'editar', 'excluir'],
        'empresa' => ['ver', 'editar'],
        'horarios' => ['ver', 'editar'],
        'usuarios' => ['ver', 'criar', 'editar', 'excluir'],
    ];

    /**
     * Mantém só telas e ações do catálogo. Quem pode criar, editar ou excluir numa tela também a vê.
     *
     * @param  array<string, mixed>  $permissoes
     * @return array<string, list<string>>
     */
    public static function normalizar(array $permissoes): array
    {
        $limpas = [];
        foreach (self::TELAS as $tela => $acoes) {
            $escolhidas = array_values(array_intersect($acoes, (array) ($permissoes[$tela] ?? [])));
            if ($escolhidas) {
                $limpas[$tela] = array_values(array_unique(['ver', ...$escolhidas]));
            }
        }

        return $limpas;
    }
}
