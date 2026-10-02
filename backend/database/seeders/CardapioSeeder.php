<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Categoria;
use App\Models\Produto;
use App\Models\ProdutoVariacao;

class CardapioSeeder extends Seeder
{
    public function run(): void
    {
        $categorias = [
            ['id' => 1, 'nome' => 'Pratos Diários', 'slug' => 'pratos-diarios', 'descricao' => 'Acompanham arroz, feijão, farofa e salada', 'ordem_exibicao' => 1],
            ['id' => 2, 'nome' => 'Pratos do Dia', 'slug' => 'pratos-do-dia', 'descricao' => 'Pratos especiais servidos em dias específicos da semana', 'ordem_exibicao' => 2],
            ['id' => 3, 'nome' => 'Porções', 'slug' => 'porcoes', 'descricao' => 'Porções adicionais para compartilhar', 'ordem_exibicao' => 3],
            ['id' => 4, 'nome' => 'Adicionais', 'slug' => 'adicionais', 'descricao' => 'Complementos para turbinar o seu prato', 'ordem_exibicao' => 4],
            ['id' => 5, 'nome' => 'Bebidas', 'slug' => 'bebidas', 'descricao' => 'Refrigerantes, sucos e água', 'ordem_exibicao' => 5],
            ['id' => 6, 'nome' => 'Cervejas', 'slug' => 'cervejas', 'descricao' => 'Cervejas em lata e long neck', 'ordem_exibicao' => 6],
        ];

        foreach ($categorias as $cat) {
            Categoria::updateOrCreate(['id' => $cat['id']], $cat);
        }

        $produtos = [
            // Pratos Diários
            [
                'id' => 1, 'categoria_id' => 1, 'tipo' => 'prato_executivo',
                'nome' => 'Filé de Frango Acebolado', 'descricao' => 'Acompanha arroz, feijão, farofa e salada', 'dias_disponiveis' => 'todos',
                'variacoes' => [['tamanho' => 'Infantil', 'preco' => 25.00], ['tamanho' => 'Grande', 'preco' => 30.00]]
            ],
            [
                'id' => 2, 'categoria_id' => 1, 'tipo' => 'prato_executivo',
                'nome' => 'Filé de Frango à Parmegiana', 'descricao' => 'Com molho de tomate artesanal e queijo gratinado', 'dias_disponiveis' => 'todos',
                'variacoes' => [['tamanho' => 'Grande', 'preco' => 30.00]]
            ],
            [
                'id' => 3, 'categoria_id' => 1, 'tipo' => 'prato_executivo',
                'nome' => 'Filé de Frango à Milanesa', 'descricao' => 'Empanado crocante e dourado', 'dias_disponiveis' => 'todos',
                'variacoes' => [['tamanho' => 'Grande', 'preco' => 30.00]]
            ],
            [
                'id' => 4, 'categoria_id' => 1, 'tipo' => 'prato_executivo',
                'nome' => 'Calabresa Acebolada', 'descricao' => 'Calabresa fatiada com cebolas refogadas', 'dias_disponiveis' => 'todos',
                'variacoes' => [['tamanho' => 'Infantil', 'preco' => 20.00], ['tamanho' => 'Médio', 'preco' => 25.00], ['tamanho' => 'Grande', 'preco' => 30.00]]
            ],
            [
                'id' => 5, 'categoria_id' => 1, 'tipo' => 'prato_executivo',
                'nome' => 'Calabresa com Queijo', 'descricao' => 'Calabresa acebolada coberta com queijo derretido', 'dias_disponiveis' => 'todos',
                'variacoes' => [['tamanho' => 'Infantil', 'preco' => 25.00], ['tamanho' => 'Médio', 'preco' => 25.00], ['tamanho' => 'Grande', 'preco' => 30.00]]
            ],
            [
                'id' => 6, 'categoria_id' => 1, 'tipo' => 'prato_executivo',
                'nome' => 'Bife em Tiras Acebolado', 'descricao' => 'Tiras de carne macia com cebola', 'dias_disponiveis' => 'todos',
                'variacoes' => [['tamanho' => 'Infantil', 'preco' => 25.00], ['tamanho' => 'Médio', 'preco' => 25.00], ['tamanho' => 'Grande', 'preco' => 35.00]]
            ],
            [
                'id' => 7, 'categoria_id' => 1, 'tipo' => 'prato_executivo',
                'nome' => 'Bife em Tiras com Queijo', 'descricao' => 'Tiras de carne acebolada cobertas com queijo', 'dias_disponiveis' => 'todos',
                'variacoes' => [['tamanho' => 'Infantil', 'preco' => 25.00], ['tamanho' => 'Médio', 'preco' => 25.00], ['tamanho' => 'Grande', 'preco' => 35.00]]
            ],
            [
                'id' => 8, 'categoria_id' => 1, 'tipo' => 'prato_executivo',
                'nome' => 'Omelete', 'descricao' => 'Omelete tradicional temperado', 'dias_disponiveis' => 'todos',
                'variacoes' => [['tamanho' => 'Infantil', 'preco' => 25.00], ['tamanho' => 'Médio', 'preco' => 25.00], ['tamanho' => 'Grande', 'preco' => 28.00]]
            ],

            // Pratos do Dia
            [
                'id' => 9, 'categoria_id' => 2, 'tipo' => 'prato_do_dia',
                'nome' => 'Feijoada Tradicional', 'descricao' => 'Acompanha arroz, couve, farofa, vinagrete e torresmo', 'dias_disponiveis' => 'quarta,sabado',
                'variacoes' => [['tamanho' => 'Individual', 'preco' => 35.00], ['tamanho' => 'Grande', 'preco' => 45.00]]
            ],
            [
                'id' => 10, 'categoria_id' => 2, 'tipo' => 'prato_do_dia',
                'nome' => 'Prato do Dia Variado', 'descricao' => 'Prato executivo especial do dia', 'dias_disponiveis' => 'segunda,terca,quinta,sexta',
                'variacoes' => [['tamanho' => 'Médio', 'preco' => 25.00], ['tamanho' => 'Grande', 'preco' => 30.00]]
            ],

            // Porções
            [
                'id' => 11, 'categoria_id' => 3, 'tipo' => 'porcao',
                'nome' => 'Batata Frita', 'descricao' => 'Batata frita crocante e sequinha', 'dias_disponiveis' => 'todos',
                'variacoes' => [['tamanho' => 'Pequena', 'preco' => 15.00], ['tamanho' => 'Média', 'preco' => 23.00]]
            ],
            [
                'id' => 12, 'categoria_id' => 3, 'tipo' => 'porcao',
                'nome' => 'Batata com Queijo', 'descricao' => 'Batata frita coberta com queijo derretido', 'dias_disponiveis' => 'todos',
                'variacoes' => [['tamanho' => 'Pequena', 'preco' => 18.00], ['tamanho' => 'Média', 'preco' => 28.00]]
            ],
            [
                'id' => 13, 'categoria_id' => 3, 'tipo' => 'porcao',
                'nome' => 'Feijão Carioca', 'descricao' => 'Porção extra de feijão caseiro temperado', 'dias_disponiveis' => 'todos',
                'variacoes' => [['tamanho' => 'Pequena', 'preco' => 15.00], ['tamanho' => 'Média', 'preco' => 25.00]]
            ],
            [
                'id' => 14, 'categoria_id' => 3, 'tipo' => 'porcao',
                'nome' => 'Arroz Branco', 'descricao' => 'Porção extra de arroz soltinho', 'dias_disponiveis' => 'todos',
                'variacoes' => [['tamanho' => 'Porção', 'preco' => 10.00]]
            ],

            // Adicionais
            [
                'id' => 15, 'categoria_id' => 4, 'tipo' => 'adicional',
                'nome' => 'Farofa da Casa', 'descricao' => 'Farofa crocante temperada', 'dias_disponiveis' => 'todos',
                'variacoes' => [['tamanho' => 'Porção', 'preco' => 7.00]]
            ],
            [
                'id' => 16, 'categoria_id' => 4, 'tipo' => 'adicional',
                'nome' => 'Mix de Legumes Refogados', 'descricao' => 'Legumes frescos refogados no azeite', 'dias_disponiveis' => 'todos',
                'variacoes' => [['tamanho' => 'Porção', 'preco' => 7.00]]
            ],
            [
                'id' => 17, 'categoria_id' => 4, 'tipo' => 'adicional',
                'nome' => 'Ovo Frito', 'descricao' => 'Ovo frito na hora', 'dias_disponiveis' => 'todos',
                'variacoes' => [['tamanho' => 'Unidade', 'preco' => 2.00]]
            ],

            // Cervejas
            [
                'id' => 18, 'categoria_id' => 6, 'tipo' => 'cerveja',
                'nome' => 'Skol 350ml', 'descricao' => 'Lata 350ml gelada', 'dias_disponiveis' => 'todos',
                'variacoes' => [['tamanho' => 'Lata', 'preco' => 8.00]]
            ],
            [
                'id' => 19, 'categoria_id' => 6, 'tipo' => 'cerveja',
                'nome' => 'Budweiser Long Neck', 'descricao' => 'Long neck 330ml gelada', 'dias_disponiveis' => 'todos',
                'variacoes' => [['tamanho' => 'Long Neck', 'preco' => 12.00]]
            ],
            [
                'id' => 20, 'categoria_id' => 6, 'tipo' => 'cerveja',
                'nome' => 'Heineken Long Neck', 'descricao' => 'Long neck 330ml gelada', 'dias_disponiveis' => 'todos',
                'variacoes' => [['tamanho' => 'Long Neck', 'preco' => 12.00]]
            ],

            // Bebidas
            [
                'id' => 21, 'categoria_id' => 5, 'tipo' => 'bebida',
                'nome' => 'Água Mineral 500ml', 'descricao' => 'Sem gás / Com gás', 'dias_disponiveis' => 'todos',
                'variacoes' => [['tamanho' => '500ml', 'preco' => 5.00]]
            ],
            [
                'id' => 22, 'categoria_id' => 5, 'tipo' => 'bebida',
                'nome' => 'Refrigerante Lata 350ml', 'descricao' => 'Coca-Cola, Guaraná, Fanta ou Sprite', 'dias_disponiveis' => 'todos',
                'variacoes' => [['tamanho' => 'Lata', 'preco' => 8.00]]
            ],
            [
                'id' => 23, 'categoria_id' => 5, 'tipo' => 'bebida',
                'nome' => 'Tubaína 600ml', 'descricao' => 'Garrafa 600ml', 'dias_disponiveis' => 'todos',
                'variacoes' => [['tamanho' => '600ml', 'preco' => 8.00]]
            ],
            [
                'id' => 24, 'categoria_id' => 5, 'tipo' => 'bebida',
                'nome' => 'Suco Del Valle Lata', 'descricao' => 'Laranja, Uva, Pêssego ou Manga', 'dias_disponiveis' => 'todos',
                'variacoes' => [['tamanho' => 'Lata', 'preco' => 10.00]]
            ],
            [
                'id' => 25, 'categoria_id' => 5, 'tipo' => 'bebida',
                'nome' => 'Limoneto', 'descricao' => 'Garrafa refrescante', 'dias_disponiveis' => 'todos',
                'variacoes' => [['tamanho' => 'Unidade', 'preco' => 10.00]]
            ],
            [
                'id' => 26, 'categoria_id' => 5, 'tipo' => 'bebida',
                'nome' => 'Refrigerante 2 Litros', 'descricao' => 'Guaraná Antarctica, Fanta ou Kuat', 'dias_disponiveis' => 'todos',
                'variacoes' => [['tamanho' => '2 Litros', 'preco' => 14.00]]
            ],
            [
                'id' => 27, 'categoria_id' => 5, 'tipo' => 'bebida',
                'nome' => 'Coca-Cola 2 Litros', 'descricao' => 'Garrafa original 2L gelada', 'dias_disponiveis' => 'todos',
                'variacoes' => [['tamanho' => '2 Litros', 'preco' => 20.00]]
            ],
        ];

        foreach ($produtos as $p) {
            $variacoes = $p['variacoes'];
            unset($p['variacoes']);

            $prod = Produto::updateOrCreate(['id' => $p['id']], $p);

            foreach ($variacoes as $v) {
                ProdutoVariacao::updateOrCreate([
                    'produto_id' => $prod->id,
                    'tamanho' => $v['tamanho'],
                ], [
                    'preco' => $v['preco'],
                ]);
            }
        }
    }
}
