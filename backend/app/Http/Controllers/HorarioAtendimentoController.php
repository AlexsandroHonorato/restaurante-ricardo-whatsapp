<?php

namespace App\Http\Controllers;

use App\Models\HorarioAtendimento;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class HorarioAtendimentoController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'fuso' => 'America/Sao_Paulo',
            'horarios' => HorarioAtendimento::orderBy('dia_semana')->get(),
        ]);
    }

    public function update(Request $request, int $dia): JsonResponse
    {
        $horario = HorarioAtendimento::where('dia_semana', $dia)->firstOrFail();
        $dados = $request->validate([
            'ativo' => 'required|boolean',
            'hora_inicio' => 'nullable|date_format:H:i',
            'hora_fim' => 'nullable|date_format:H:i',
        ]);
        if ($request->boolean('ativo')) {
            if (empty($dados['hora_inicio']) || empty($dados['hora_fim']) || $dados['hora_fim'] <= $dados['hora_inicio']) {
                throw ValidationException::withMessages(['hora_fim' => 'Informe início e fim; o fim deve ser posterior ao início no mesmo dia.']);
            }
            $dados['hora_inicio'] .= ':00';
            $dados['hora_fim'] .= ':00';
        } else {
            $dados['hora_inicio'] = null;
            $dados['hora_fim'] = null;
        }
        $horario->update($dados);

        return response()->json(['message' => 'Horário de atendimento atualizado.', 'horario' => $horario->fresh()]);
    }
}
