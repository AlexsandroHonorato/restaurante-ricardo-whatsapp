-- =============================================================================
-- BANCO DE DADOS: agente-watsapp (MySQL 8.0+)
-- Arquitetura relacional completa e otimizada para Dashboard e Operação
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `agente-watsapp`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `agente-watsapp`;

-- Desabilita checagem de chave estrangeira temporariamente para recriação limpa se necessário
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1. TABELA: clientes
-- Armazena o perfil do cliente no WhatsApp e métricas de fidelidade (LTV)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `clientes`;
CREATE TABLE `clientes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `telefone` VARCHAR(30) NOT NULL COMMENT 'Número no padrão WhatsApp (ex: 5512997500045)',
  `nome` VARCHAR(150) NULL,
  `primeiro_contato_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultimo_contato_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `total_pedidos` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Total histórico de pedidos concluídos',
  `total_gasto` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'LTV (Lifetime Value) acumulado',
  `ativo` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_clientes_telefone` (`telefone`),
  INDEX `idx_clientes_nome` (`nome`),
  INDEX `idx_clientes_total_pedidos` (`total_pedidos`),
  INDEX `idx_clientes_total_gasto` (`total_gasto`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. TABELA: enderecos
-- Armazena histórico de endereços de entrega (Heatmap por bairro para o Dashboard)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `enderecos`;
CREATE TABLE `enderecos` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `cliente_id` BIGINT UNSIGNED NOT NULL,
  `logradouro` VARCHAR(255) NOT NULL COMMENT 'Rua / Avenida / Travessa',
  `numero` VARCHAR(30) NOT NULL,
  `bairro` VARCHAR(100) NOT NULL COMMENT 'Utilizado para métricas de entrega por região',
  `complemento` VARCHAR(100) NULL,
  `ponto_referencia` VARCHAR(255) NULL,
  `cep` VARCHAR(20) NULL,
  `cidade` VARCHAR(100) NOT NULL DEFAULT 'Caraguatatuba',
  `estado` VARCHAR(2) NOT NULL DEFAULT 'SP',
  `padrao` TINYINT(1) NOT NULL DEFAULT 1,
  `criado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_enderecos_cliente` (`cliente_id`),
  INDEX `idx_enderecos_bairro` (`bairro`),
  CONSTRAINT `fk_enderecos_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. TABELA: categorias
-- Categorias do cardápio (Pratos Diários, Pratos do Dia, Porções, Bebidas, etc.)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `categorias`;
CREATE TABLE `categorias` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(100) NOT NULL,
  `descricao` VARCHAR(255) NULL,
  `ordem_exibicao` INT NOT NULL DEFAULT 0,
  `ativo` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_categorias_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. TABELA: produtos
-- Catálogo mestre unificado de pratos, porções, adicionais e bebidas
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `produtos`;
CREATE TABLE `produtos` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `categoria_id` INT UNSIGNED NOT NULL,
  `tipo` ENUM('prato_executivo', 'prato_do_dia', 'porcao', 'adicional', 'bebida', 'cerveja') NOT NULL,
  `nome` VARCHAR(150) NOT NULL,
  `descricao` TEXT NULL,
  `dias_disponiveis` VARCHAR(100) NOT NULL DEFAULT 'todos' COMMENT 'ex: todos | quarta,sabado | seg,ter,qui,sex',
  `ativo` TINYINT(1) NOT NULL DEFAULT 1,
  `criado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_produtos_categoria` (`categoria_id`),
  INDEX `idx_produtos_tipo` (`tipo`),
  INDEX `idx_produtos_ativo` (`ativo`),
  CONSTRAINT `fk_produtos_categoria` FOREIGN KEY (`categoria_id`) REFERENCES `categorias` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. TABELA: produto_variacoes
-- Variações de tamanho e preço para cada produto (Infantil, Médio, Grande, 2L, Lata)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `produto_variacoes`;
CREATE TABLE `produto_variacoes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `produto_id` BIGINT UNSIGNED NOT NULL,
  `tamanho` VARCHAR(50) NOT NULL COMMENT 'ex: Infantil, Médio, Grande, Pequena, Lata, 2 Litros, Unidade',
  `preco` DECIMAL(10,2) NOT NULL,
  `codigo_sku` VARCHAR(50) NULL,
  `ativo` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  INDEX `idx_variacoes_produto` (`produto_id`),
  CONSTRAINT `fk_variacoes_produto` FOREIGN KEY (`produto_id`) REFERENCES `produtos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5.1 TABELA: status_pedidos
-- Catálogo oficial de status operacionais dos pedidos com metadados e cores
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `status_pedidos`;
CREATE TABLE `status_pedidos` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `codigo` VARCHAR(50) NOT NULL,
  `nome` VARCHAR(100) NOT NULL,
  `descricao` TEXT NULL,
  `cor_badge` VARCHAR(20) NOT NULL DEFAULT '#6B7280',
  `icone` VARCHAR(50) NULL,
  `ordem` INT UNSIGNED NOT NULL DEFAULT 0,
  `ativo` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_status_pedidos_codigo` (`codigo`),
  INDEX `idx_status_pedidos_ativo` (`ativo`),
  INDEX `idx_status_pedidos_ordem` (`ordem`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6. TABELA: pedidos
-- Registro central de pedidos delivery (Faturamento, Status, Prazos e Pagamento)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `pedidos`;
CREATE TABLE `pedidos` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `codigo_pedido` VARCHAR(30) NOT NULL COMMENT 'Código amigável gerado (ex: PED-021430-A1B)',
  `cliente_id` BIGINT UNSIGNED NOT NULL,
  `endereco_id` BIGINT UNSIGNED NULL,
  `status` ENUM('pendente', 'confirmado', 'em_preparo', 'saiu_para_entrega', 'entregue', 'cancelado') NOT NULL DEFAULT 'pendente',
  `forma_pagamento` ENUM('dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'outro') NOT NULL,
  `valor_subtotal` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `taxa_entrega` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `valor_desconto` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `valor_total` DECIMAL(10,2) NOT NULL,
  `troco_para` DECIMAL(10,2) NULL COMMENT 'Valor informado pelo cliente para troco em dinheiro',
  `valor_troco` DECIMAL(10,2) NULL COMMENT 'Troco calculado a ser devolvido',
  `tempo_estimado_min` INT NOT NULL DEFAULT 50 COMMENT 'Tempo estimado informado (ex: 40-60 min)',
  `observacoes` TEXT NULL,
  `origem` VARCHAR(50) NOT NULL DEFAULT 'whatsapp_ia',
  `criado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `preparado_em` DATETIME NULL,
  `saiu_entrega_em` DATETIME NULL,
  `entregue_em` DATETIME NULL,
  `cancelado_em` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_pedidos_codigo` (`codigo_pedido`),
  INDEX `idx_pedidos_cliente` (`cliente_id`),
  INDEX `idx_pedidos_endereco` (`endereco_id`),
  INDEX `idx_pedidos_status` (`status`),
  INDEX `idx_pedidos_forma_pagamento` (`forma_pagamento`),
  INDEX `idx_pedidos_criado_em` (`criado_em`),
  CONSTRAINT `fk_pedidos_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`),
  CONSTRAINT `fk_pedidos_endereco` FOREIGN KEY (`endereco_id`) REFERENCES `enderecos` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 7. TABELA: pedido_itens
-- Itens contratados em cada pedido (Snapshot histórico de nome e preço)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `pedido_itens`;
CREATE TABLE `pedido_itens` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `pedido_id` BIGINT UNSIGNED NOT NULL,
  `produto_id` BIGINT UNSIGNED NULL COMMENT 'Pode ser nulo caso o produto do catálogo seja deletado futuramente',
  `variacao_id` BIGINT UNSIGNED NULL,
  `nome_snapshot` VARCHAR(150) NOT NULL COMMENT 'Nome no momento da venda',
  `tamanho_snapshot` VARCHAR(50) NOT NULL COMMENT 'Tamanho no momento da venda',
  `quantidade` INT UNSIGNED NOT NULL DEFAULT 1,
  `preco_unitario` DECIMAL(10,2) NOT NULL,
  `subtotal` DECIMAL(10,2) NOT NULL,
  `observacao` VARCHAR(255) NULL COMMENT 'ex: Sem cebola, bife bem passado',
  PRIMARY KEY (`id`),
  INDEX `idx_pedido_itens_pedido` (`pedido_id`),
  INDEX `idx_pedido_itens_produto` (`produto_id`),
  CONSTRAINT `fk_pedido_itens_pedido` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pedido_itens_produto` FOREIGN KEY (`produto_id`) REFERENCES `produtos` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_pedido_itens_variacao` FOREIGN KEY (`variacao_id`) REFERENCES `produto_variacoes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 8. TABELA: pedido_item_adicionais
-- Adicionais / complementos associados a um prato específico
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `pedido_item_adicionais`;
CREATE TABLE `pedido_item_adicionais` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `pedido_item_id` BIGINT UNSIGNED NOT NULL,
  `produto_id` BIGINT UNSIGNED NULL,
  `nome_snapshot` VARCHAR(150) NOT NULL COMMENT 'ex: Ovo Frito, Farofa, Mix de Legumes',
  `quantidade` INT UNSIGNED NOT NULL DEFAULT 1,
  `preco_unitario` DECIMAL(10,2) NOT NULL,
  `subtotal` DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_adicionais_item` (`pedido_item_id`),
  CONSTRAINT `fk_adicionais_item` FOREIGN KEY (`pedido_item_id`) REFERENCES `pedido_itens` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_adicionais_produto` FOREIGN KEY (`produto_id`) REFERENCES `produtos` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 9. TABELA: atendimentos (Métricas de IA e Conversão no WhatsApp)
-- Essencial para o Dashboard: TMA, Taxa de Conversão da IA e Taxa de Transbordo
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `atendimentos`;
CREATE TABLE `atendimentos` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `cliente_id` BIGINT UNSIGNED NOT NULL,
  `pedido_id` BIGINT UNSIGNED NULL COMMENT 'Preenchido caso o atendimento resulte em pedido',
  `inicio_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fim_em` DATETIME NULL,
  `duracao_segundos` INT UNSIGNED NULL,
  `status` ENUM('em_andamento', 'finalizado_com_pedido', 'finalizado_sem_pedido', 'transbordo_humano', 'abandonado') NOT NULL DEFAULT 'em_andamento',
  `total_mensagens_cliente` INT UNSIGNED NOT NULL DEFAULT 0,
  `total_mensagens_bot` INT UNSIGNED NOT NULL DEFAULT 0,
  `transbordo_humano` TINYINT(1) NOT NULL DEFAULT 0,
  `motivo_transbordo` VARCHAR(255) NULL COMMENT 'ex: atraso_pedido, duvida_fora_cardapio, solicitacao_cliente',
  `tokens_estimados` INT UNSIGNED NOT NULL DEFAULT 0,
  `canal` VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
  PRIMARY KEY (`id`),
  INDEX `idx_atendimentos_cliente` (`cliente_id`),
  INDEX `idx_atendimentos_pedido` (`pedido_id`),
  INDEX `idx_atendimentos_status` (`status`),
  INDEX `idx_atendimentos_inicio` (`inicio_em`),
  INDEX `idx_atendimentos_transbordo` (`transbordo_humano`),
  CONSTRAINT `fk_atendimentos_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`),
  CONSTRAINT `fk_atendimentos_pedido` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 10. TABELA: historico_status_pedidos (Auditoria & Lead Time da Cozinha/Entrega)
-- Permite ao Dashboard calcular Tempo de Preparo, Tempo de Entrega e Gargalos
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `historico_status_pedidos`;
CREATE TABLE `historico_status_pedidos` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `pedido_id` BIGINT UNSIGNED NOT NULL,
  `status_anterior` VARCHAR(50) NULL,
  `status_novo` VARCHAR(50) NOT NULL,
  `alterado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `alterado_por` VARCHAR(100) NOT NULL DEFAULT 'ia_bot' COMMENT 'ex: ia_bot, cozinha_painel, motoboy_app, admin',
  `observacao` VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_historico_pedido` (`pedido_id`),
  INDEX `idx_historico_alterado_em` (`alterado_em`),
  CONSTRAINT `fk_historico_pedido` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 11. TABELA: status_conversas (Estado Ativo da Conversa & Rascunho)
-- Armazena o estágio do atendimento no WhatsApp, rascunho de itens e expiração de 30min
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `status_conversas`;
CREATE TABLE `status_conversas` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `telefone` VARCHAR(30) NOT NULL,
  `status_atual` VARCHAR(50) NOT NULL DEFAULT 'conversa_iniciada',
  `status_anterior` VARCHAR(50) NULL,
  `rascunho` JSON NULL,
  `ultimo_contato_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `expira_em` DATETIME NULL,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_status_telefone` (`telefone`),
  INDEX `idx_status_conversas_status` (`status_atual`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- Configuração semanal: 1 = segunda-feira, 7 = domingo (America/Sao_Paulo).
CREATE TABLE IF NOT EXISTS `horarios_atendimento` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `dia_semana` TINYINT UNSIGNED NOT NULL,
  `ativo` TINYINT(1) NOT NULL DEFAULT 0,
  `hora_inicio` TIME NULL,
  `hora_fim` TIME NULL,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_horarios_dia_semana` (`dia_semana`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
