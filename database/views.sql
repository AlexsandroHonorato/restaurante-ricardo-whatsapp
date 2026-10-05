-- =============================================================================
-- VIEWS ANALÍTICAS (MySQL) — opcionais, para consultas/BI fora do painel.
-- O painel não usa estas views (o DashboardController consulta as tabelas).
-- Colunas conferidas com as migrations (database/schema.sql). Aplicar no banco da empresa:
--   mysql -u USUARIO -p NOME_DO_BANCO < database/views.sql
-- Datas gravadas em UTC; agrupamento por dia no horário de Brasília (-03:00, sem horário de verão).
-- =============================================================================

-- VIEW 1: KPIs gerais (faturamento, pedidos, ticket médio, pedidos por status)
CREATE OR REPLACE VIEW `v_dashboard_kpis_gerais` AS
SELECT
  COUNT(DISTINCT p.id) AS total_pedidos,
  IFNULL(SUM(CASE WHEN p.status != 'cancelado' THEN p.valor_total ELSE 0 END), 0) AS faturamento_total,
  IFNULL(AVG(CASE WHEN p.status != 'cancelado' THEN p.valor_total ELSE NULL END), 0) AS ticket_medio,
  COUNT(DISTINCT p.cliente_id) AS total_clientes_unicos,
  SUM(CASE WHEN p.status = 'pendente' THEN 1 ELSE 0 END) AS pedidos_pendentes,
  SUM(CASE WHEN p.status = 'em_preparo' THEN 1 ELSE 0 END) AS pedidos_em_preparo,
  SUM(CASE WHEN p.status = 'saiu_para_entrega' THEN 1 ELSE 0 END) AS pedidos_em_rota,
  SUM(CASE WHEN p.status = 'entregue' THEN 1 ELSE 0 END) AS pedidos_entregues,
  SUM(CASE WHEN p.status = 'cancelado' THEN 1 ELSE 0 END) AS pedidos_cancelados
FROM `pedidos` p;

-- VIEW 2: vendas por dia (horário de Brasília)
CREATE OR REPLACE VIEW `v_dashboard_vendas_por_dia` AS
SELECT
  DATE(CONVERT_TZ(p.created_at, '+00:00', '-03:00')) AS data,
  COUNT(p.id) AS quantidade_pedidos,
  SUM(CASE WHEN p.status != 'cancelado' THEN p.valor_total ELSE 0 END) AS faturamento,
  AVG(CASE WHEN p.status != 'cancelado' THEN p.valor_total ELSE NULL END) AS ticket_medio
FROM `pedidos` p
GROUP BY DATE(CONVERT_TZ(p.created_at, '+00:00', '-03:00'));

-- VIEW 3: ranking de itens vendidos (nome e tamanho do momento da venda)
CREATE OR REPLACE VIEW `v_dashboard_ranking_produtos` AS
SELECT
  pi.nome_snapshot AS produto,
  pi.tamanho_snapshot AS tamanho,
  prod.tipo AS tipo_produto,
  cat.nome AS categoria,
  SUM(pi.quantidade) AS total_unidades_vendidas,
  SUM(pi.subtotal) AS receita_total_gerada
FROM `pedido_itens` pi
JOIN `pedidos` ped ON pi.pedido_id = ped.id
LEFT JOIN `produtos` prod ON pi.produto_id = prod.id
LEFT JOIN `categorias` cat ON prod.categoria_id = cat.id
WHERE ped.status != 'cancelado'
GROUP BY pi.nome_snapshot, pi.tamanho_snapshot, prod.tipo, cat.nome;

-- VIEW 4: pedidos e receita por bairro
CREATE OR REPLACE VIEW `v_dashboard_mapa_bairros` AS
SELECT
  IFNULL(e.bairro, 'Balcão / Não Informado') AS bairro,
  COUNT(p.id) AS total_pedidos,
  SUM(CASE WHEN p.status != 'cancelado' THEN p.valor_total ELSE 0 END) AS faturamento_bairro,
  AVG(CASE WHEN p.status != 'cancelado' THEN p.valor_total ELSE NULL END) AS ticket_medio_bairro
FROM `pedidos` p
LEFT JOIN `enderecos` e ON p.endereco_id = e.id
GROUP BY IFNULL(e.bairro, 'Balcão / Não Informado');

-- VIEW 5: formas de pagamento (pedidos não cancelados)
CREATE OR REPLACE VIEW `v_dashboard_formas_pagamento` AS
SELECT
  p.forma_pagamento,
  COUNT(p.id) AS total_pedidos,
  SUM(p.valor_total) AS total_faturado,
  ROUND(COUNT(p.id) * 100.0 / NULLIF((SELECT COUNT(*) FROM `pedidos` WHERE status != 'cancelado'), 0), 2) AS percentual_pedidos
FROM `pedidos` p
WHERE p.status != 'cancelado'
GROUP BY p.forma_pagamento;

-- VIEW 6: desempenho do bot (conversão, transbordo, duração)
CREATE OR REPLACE VIEW `v_dashboard_metricas_ia_atendimento` AS
SELECT
  COUNT(a.id) AS total_atendimentos,
  SUM(CASE WHEN a.status = 'finalizado_com_pedido' THEN 1 ELSE 0 END) AS atendimentos_convertidos_em_pedido,
  ROUND(SUM(CASE WHEN a.status = 'finalizado_com_pedido' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(a.id), 0), 2) AS taxa_conversao_percentual,
  SUM(CASE WHEN a.transbordo_humano = 1 THEN 1 ELSE 0 END) AS total_transbordos_humanos,
  ROUND(SUM(CASE WHEN a.transbordo_humano = 1 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(a.id), 0), 2) AS taxa_transbordo_percentual,
  AVG(a.duracao_segundos) AS tempo_medio_atendimento_segundos,
  AVG(a.total_mensagens_cliente + a.total_mensagens_bot) AS media_mensagens_por_conversa
FROM `atendimentos` a;
