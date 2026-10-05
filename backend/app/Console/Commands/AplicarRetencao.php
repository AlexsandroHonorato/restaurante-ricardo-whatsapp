<?php

namespace App\Console\Commands;

use App\Support\DadosPessoais;
use Illuminate\Console\Command;

class AplicarRetencao extends Command
{
    protected $signature = 'botclient:aplicar-retencao';

    protected $description = 'LGPD: apaga conversas antigas e anonimiza clientes inativos (prazos em config/services.php)';

    public function handle(): int
    {
        $resultado = DadosPessoais::aplicarRetencao(
            (int) config('services.retencao.mensagens_dias'),
            (int) config('services.retencao.clientes_inativos_dias'),
        );
        $this->info("Mensagens apagadas: {$resultado['mensagens']}; clientes anonimizados: {$resultado['clientes']}.");

        return self::SUCCESS;
    }
}
