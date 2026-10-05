<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class SchemaReferenciaTest extends TestCase
{
    use RefreshDatabase;

    public function test_schema_sql_de_referencia_tem_todas_as_tabelas_das_migrations(): void
    {
        preg_match_all('/^CREATE TABLE `(\w+)`/m', file_get_contents(base_path('../database/schema.sql')), $m);
        $tabelas = collect(Schema::getTableListing(schemaQualified: false))->sort()->values()->all();

        $this->assertSame($tabelas, collect($m[1])->sort()->values()->all(), 'Rode `php artisan botclient:exportar-schema` (MySQL) após criar ou remover tabelas.');
    }
}
