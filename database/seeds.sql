-- =============================================================================
-- SEED DE DADOS: Cardápio Oficial Restaurante Família Ricardo
-- Popula categorias, produtos e variações de preços baseados no negocio.md
-- =============================================================================

USE `agente-watsapp`;

-- 1. Categorias
INSERT INTO `categorias` (`id`, `nome`, `slug`, `descricao`, `ordem_exibicao`) VALUES
(1, 'Pratos Diários', 'pratos-diarios', 'Acompanham arroz, feijão, farofa e salada', 1),
(2, 'Pratos do Dia', 'pratos-do-dia', 'Pratos especiais servidos em dias específicos da semana', 2),
(3, 'Porções', 'porcoes', 'Porções adicionais para compartilhar', 3),
(4, 'Adicionais', 'adicionais', 'Complementos para turbinar o seu prato', 4),
(5, 'Bebidas', 'bebidas', 'Refrigerantes, sucos e água', 5),
(6, 'Cervejas', 'cervejas', 'Cervejas em lata e long neck', 6)
ON DUPLICATE KEY UPDATE `nome` = VALUES(`nome`);

-- 2. Produtos
INSERT INTO `produtos` (`id`, `categoria_id`, `tipo`, `nome`, `descricao`, `dias_disponiveis`) VALUES
-- Pratos Diários
(1, 1, 'prato_executivo', 'Filé de Frango Acebolado', 'Acompanha arroz, feijão, farofa e salada', 'todos'),
(2, 1, 'prato_executivo', 'Filé de Frango à Parmegiana', 'Com molho de tomate artesanal e queijo gratinado', 'todos'),
(3, 1, 'prato_executivo', 'Filé de Frango à Milanesa', 'Empanado crocante e dourado', 'todos'),
(4, 1, 'prato_executivo', 'Calabresa Acebolada', 'Calabresa fatiada com cebolas refogadas', 'todos'),
(5, 1, 'prato_executivo', 'Calabresa com Queijo', 'Calabresa acebolada coberta com queijo derretido', 'todos'),
(6, 1, 'prato_executivo', 'Bife em Tiras Acebolado', 'Tiras de carne macia com cebola', 'todos'),
(7, 1, 'prato_executivo', 'Bife em Tiras com Queijo', 'Tiras de carne acebolada cobertas com queijo', 'todos'),
(8, 1, 'prato_executivo', 'Omelete', 'Omelete tradicional temperado', 'todos'),

-- Prato do Dia
(9, 2, 'prato_do_dia', 'Feijoada Tradicional', 'Acompanha arroz, couve, farofa, vinagrete e torresmo', 'quarta,sabado'),
(10, 2, 'prato_do_dia', 'Prato do Dia Variado', 'Prato especial do dia da semana', 'segunda,terca,quinta,sexta'),

-- Porções
(11, 3, 'porcao', 'Batata Frita', 'Batata frita crocante e sequinha', 'todos'),
(12, 3, 'porcao', 'Batata com Queijo', 'Batata frita coberta com queijo derretido', 'todos'),
(13, 3, 'porcao', 'Feijão Carioca', 'Porção extra de feijão caseiro temperado', 'todos'),
(14, 3, 'porcao', 'Arroz Branco', 'Porção extra de arroz soltinho', 'todos'),

-- Adicionais
(15, 4, 'adicional', 'Farofa da Casa', 'Farofa crocante temperada', 'todos'),
(16, 4, 'adicional', 'Mix de Legumes Refogados', 'Legumes frescos refogados no azeite', 'todos'),
(17, 4, 'adicional', 'Ovo Frito', 'Ovo frito na hora', 'todos'),

-- Cervejas
(18, 6, 'cerveja', 'Skol 350ml', 'Lata 350ml gelada', 'todos'),
(19, 6, 'cerveja', 'Budweiser Long Neck', 'Long neck 330ml gelada', 'todos'),
(20, 6, 'cerveja', 'Heineken Long Neck', 'Long neck 330ml gelada', 'todos'),

-- Bebidas
(21, 5, 'bebida', 'Água Mineral 500ml', 'Sem gás / Com gás', 'todos'),
(22, 5, 'bebida', 'Refrigerante Lata 350ml', 'Coca-Cola, Guaraná, Fanta ou Sprite', 'todos'),
(23, 5, 'bebida', 'Tubaína 600ml', 'Garrafa 600ml', 'todos'),
(24, 5, 'bebida', 'Suco Del Valle Lata', 'Laranja, Uva, Pêssego ou Manga', 'todos'),
(25, 5, 'bebida', 'Limoneto', 'Garrafa refrescante', 'todos'),
(26, 5, 'bebida', 'Refrigerante 2 Litros', 'Guaraná Antarctica, Fanta ou Kuat', 'todos'),
(27, 5, 'bebida', 'Coca-Cola 2 Litros', 'Garrafa original 2L gelada', 'todos')
ON DUPLICATE KEY UPDATE `nome` = VALUES(`nome`), `categoria_id` = VALUES(`categoria_id`);

-- 3. Variações de Preço por Tamanho
INSERT INTO `produto_variacoes` (`produto_id`, `tamanho`, `preco`) VALUES
-- Filé de Frango Acebolado
(1, 'Infantil', 25.00),
(1, 'Grande', 30.00),

-- Filé de Frango à Parmegiana
(2, 'Grande', 30.00),

-- Filé de Frango à Milanesa
(3, 'Grande', 30.00),

-- Calabresa Acebolada
(4, 'Infantil', 20.00),
(4, 'Médio', 25.00),
(4, 'Grande', 30.00),

-- Calabresa com Queijo
(5, 'Infantil', 25.00),
(5, 'Médio', 25.00),
(5, 'Grande', 30.00),

-- Bife em Tiras Acebolado
(6, 'Infantil', 25.00),
(6, 'Médio', 25.00),
(6, 'Grande', 35.00),

-- Bife em Tiras com Queijo
(7, 'Infantil', 25.00),
(7, 'Médio', 25.00),
(7, 'Grande', 35.00),

-- Omelete
(8, 'Infantil', 25.00),
(8, 'Médio', 25.00),
(8, 'Grande', 28.00),

-- Feijoada Tradicional
(9, 'Individual', 35.00),
(9, 'Grande', 45.00),

-- Prato do Dia Variado
(10, 'Médio', 25.00),
(10, 'Grande', 30.00),

-- Batata Frita
(11, 'Pequena', 15.00),
(11, 'Média', 23.00),

-- Batata com Queijo
(12, 'Pequena', 18.00),
(12, 'Média', 28.00),

-- Feijão Carioca
(13, 'Pequena', 15.00),
(13, 'Média', 25.00),

-- Arroz Branco
(14, 'Porção', 10.00),

-- Adicionais
(15, 'Porção', 7.00),
(16, 'Porção', 7.00),
(17, 'Unidade', 2.00),

-- Cervejas
(18, 'Lata', 8.00),
(19, 'Long Neck', 12.00),
(20, 'Long Neck', 12.00),

-- Bebidas
(21, '500ml', 5.00),
(22, 'Lata', 8.00),
(23, '600ml', 8.00),
(24, 'Lata', 10.00),
(25, 'Unidade', 10.00),
(26, '2 Litros', 14.00),
(27, '2 Litros', 20.00);
