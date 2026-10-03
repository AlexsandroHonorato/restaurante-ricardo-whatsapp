<?php

namespace App;

use App\Models\Atendimento;
use App\Models\HorarioAtendimento;
use App\Models\Pedido;
use Carbon\Carbon;

class DashboardAnalise
{
    public function intervalo(int $dias): array
    {
        $fim = Carbon::now('America/Sao_Paulo')->startOfDay()->addDay();

        return [$fim->copy()->subDays($dias)->utc(), $fim->copy()->utc()];
    }

    public function calcular(int $dias): array
    {
        [$inicio,$fim] = $this->intervalo($dias);
        $pedidos = Pedido::where('created_at', '>=', $inicio)->where('created_at', '<', $fim)->get();
        $agenda = HorarioAtendimento::all()->keyBy('dia_semana');
        $vendas = [];
        $mapa = [];
        $fora = 0;
        for ($i = 0; $i < $dias; $i++) {
            $data = $inicio->copy()->timezone('America/Sao_Paulo')->addDays($i)->format('Y-m-d');
            $vendas[$data] = ['data' => $data, 'total_pedidos' => 0, 'pedidos_validos' => 0, 'faturamento' => 0, 'ticket_medio' => null];
        }
        for ($d = 1; $d <= 7; $d++) {
            for ($h = 0; $h < 24; $h++) {
                $a = $agenda->get($d);
                $aberto = $a && $a->ativo && sprintf('%02d:00:00', $h) < $a->hora_fim && sprintf('%02d:00:00', $h + 1) > $a->hora_inicio;
                $mapa[$d][$h] = ['hora' => $h, 'pedidos' => 0, 'atendimento' => (bool) $aberto];
            }
        }
        $amostras = ['preparo' => [], 'entrega' => [], 'total' => []];
        $motivos = [];
        foreach ($pedidos as $p) {
            $local = $p->created_at->copy()->timezone('America/Sao_Paulo');
            $data = $local->format('Y-m-d');
            $d = $local->dayOfWeekIso;
            $h = $local->hour;
            $mapa[$d][$h]['pedidos']++;
            $a = $agenda->get($d);
            if (! $a || ! $a->ativo || $local->format('H:i:s') < $a->hora_inicio || $local->format('H:i:s') >= $a->hora_fim) {
                $fora++;
            }
            $vendas[$data]['total_pedidos']++;
            if ($p->status === 'cancelado') {
                $motivo = trim($p->motivo_cancelamento ?? '') ?: 'Não informado';
                $motivos[$motivo] = ($motivos[$motivo] ?? 0) + 1;

                continue;
            }
            $vendas[$data]['pedidos_validos']++;
            $vendas[$data]['faturamento'] += (float) $p->valor_total;
            foreach (['preparo' => [$p->preparado_em, $p->saiu_entrega_em], 'entrega' => [$p->saiu_entrega_em, $p->entregue_em], 'total' => [$p->created_at, $p->entregue_em]] as $tipo => [$a,$b]) {
                if ($a && $b && $b->gte($a)) {
                    $amostras[$tipo][] = $a->diffInSeconds($b) / 60;
                }
            }
        }
        foreach ($vendas as &$v) {
            $v['faturamento'] = round($v['faturamento'], 2);
            $v['ticket_medio'] = $v['pedidos_validos'] ? round($v['faturamento'] / $v['pedidos_validos'], 2) : null;
        } unset($v);
        $tempos = [];
        foreach ($amostras as $tipo => $valores) {
            $tempos[] = ['tipo' => $tipo, 'minutos' => count($valores) ? round(array_sum($valores) / count($valores), 1) : null, 'amostras' => count($valores)];
        }
        $atendimentos = Atendimento::where('inicio_em', '>=', $inicio)->where('inicio_em', '<', $fim)->get();
        $status = $atendimentos->countBy('status');
        $abandonos = $atendimentos->where('status', 'abandonado')->countBy(fn ($a) => $a->etapa_abandono ?: 'Não registrado');
        $linhas = fn ($contagens) => collect($contagens)->map(fn ($total, $nome) => ['nome' => $nome, 'total' => $total])->sortByDesc('total')->values()->all();

        return ['dias' => $dias, 'fuso' => 'America/Sao_Paulo', 'vendas' => array_values($vendas), 'demanda' => array_map(fn ($d, $horas) => ['dia' => $d, 'horas' => array_values($horas)], array_keys($mapa), array_values($mapa)), 'pedidos_fora_agenda' => $fora, 'tempos' => $tempos, 'atendimentos' => ['total' => $atendimentos->count(), 'conversao' => $atendimentos->count() ? round(($status['finalizado_com_pedido'] ?? 0) / $atendimentos->count() * 100, 1) : null, 'status' => $linhas($status), 'abandonos' => $linhas($abandonos)], 'cancelamentos' => $linhas($motivos)];
    }
}
