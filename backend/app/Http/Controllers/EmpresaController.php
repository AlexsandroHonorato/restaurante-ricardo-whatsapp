<?php

namespace App\Http\Controllers;

use App\Models\Empresa;
use App\Models\HorarioAtendimento;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class EmpresaController extends Controller
{
    private const DIAS = ['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo'];

    public function show(): JsonResponse
    {
        return response()->json(Empresa::atual());
    }

    public function update(Request $request): JsonResponse
    {
        $telefone = ['nullable', 'string', 'max:30', 'regex:/^[0-9 ()+-]+$/'];
        $dados = $request->validate([
            'nome' => 'required|string|min:2|max:150',
            'tipo_negocio' => ['sometimes', Rule::in(Empresa::TIPOS)],
            'telefone' => $telefone,
            'telefone_2' => $telefone,
            'endereco' => 'nullable|string|max:255',
            'quem_somos' => 'nullable|string|max:4000',
            'formas_pagamento' => 'nullable|string|max:4000',
            'politicas' => 'nullable|string|max:4000',
            'minutos_mensagem_antiga' => 'sometimes|integer|min:1|max:1440',
            'minutos_fila_acumulada' => 'sometimes|integer|min:1|max:60',
        ]);
        $empresa = Empresa::atual();
        $antiga = $dados['minutos_mensagem_antiga'] ?? $empresa->minutos_mensagem_antiga;
        $fila = $dados['minutos_fila_acumulada'] ?? $empresa->minutos_fila_acumulada;
        if ($fila > $antiga) {
            throw ValidationException::withMessages(['minutos_fila_acumulada' => 'O tempo da fila acumulada não pode ser maior que o tempo para ignorar mensagens antigas.']);
        }
        $empresa->update($dados);

        return response()->json($empresa);
    }

    /** Para o bot: contatos e a ficha em seções Markdown (só as preenchidas), com horários vindos da agenda. */
    public function paraBot(): JsonResponse
    {
        $empresa = Empresa::atual();
        $secoes = array_filter([
            'Quem somos' => $empresa->quem_somos,
            'Endereço e Localização' => $empresa->endereco,
            'Formas de Pagamento' => $empresa->formas_pagamento,
            'Políticas e Regras' => $empresa->politicas,
        ]);
        // Ficha vazia: o bot continua usando o negocio.md; com ficha, os horários vêm da agenda (sempre atual).
        if ($secoes) {
            $horarios = HorarioAtendimento::orderBy('dia_semana')->get()->map(fn ($h) => self::DIAS[$h->dia_semana - 1].': '
                .($h->ativo ? substr($h->hora_inicio, 0, 5).' às '.substr($h->hora_fim, 0, 5) : 'fechado'))->implode("\n");
            $secoes = array_slice($secoes, 0, 1, true) + ['Horários de Atendimento' => $horarios] + array_slice($secoes, 1, null, true);
        }
        $texto = implode("\n\n", array_map(fn ($titulo, $conteudo) => "## {$titulo}\n".trim($conteudo), array_keys($secoes), $secoes));

        return response()->json([
            'nome' => $empresa->nome, 'tipo_negocio' => $empresa->tipo_negocio ?? 'restaurante', 'telefone' => $empresa->telefone, 'telefone_2' => $empresa->telefone_2, 'texto' => $texto,
            'minutos_mensagem_antiga' => $empresa->minutos_mensagem_antiga, 'minutos_fila_acumulada' => $empresa->minutos_fila_acumulada,
        ]);
    }
}
