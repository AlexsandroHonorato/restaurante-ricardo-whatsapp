# Design System do restaurante

Referência: https://www.figma.com/design/bTVUDIZAGX09EtJnfQTaRv/Free-Admin-Dashboard--Community-?node-id=2-3
Inspecionadas as páginas Style Guide, Design System e UI Designs pelo navegador, sem editar o arquivo.

## Tokens observados e adaptações

O guia identifica DM Sans como tipografia. Marca clara: primary #3A36DB, secondary #FF69B4, accent #03A89E; texto #06152B, secundário #99B2C6, disabled #CFD9E0; superfícies #FFFFFF / #F1F4FA / #DDDDE8.
Marca escura observada: primary #605CFF, secondary #FF69B4, accent #2FE5A7. Rótulos das superfícies escuras: background #1A202C, grey #364153, border #2C3240, neutral #FFFFFF.

Implementação atual usa a versão escura para preservar o modo do produto existente. Superfície de card #242B3A, elevada #30394B, bordas #424B60 e texto secundário #C0C9DA são adaptações para separar níveis e manter legibilidade. Texto roxo #B5B2FF é usado na navegação, enquanto botões de marca têm texto branco.
Spacing 4/8/12/16/24/32 e radius 6/10/14/20 são decisões de implementação inspiradas na composição, não medidas exportadas do Figma. Não houve acesso autenticado ao inspector; não afirmar igualdade pixel a pixel.

## Arquitetura visual

- frontend/src/design-system.css: tokens e contratos compartilhados de tabela, foco e heading; styles.css mantém compatibilidade com glass-card, btn e badge existentes.
- shared/ui/IconComponent: ícones SVG de navegação, decorativos para leitores de tela.
- shared/ui/PedidoStatusComponent: texto + símbolo + cor, com mapeamento centralizado dos seis status reais.
- shared/ui/PedidosRecentesComponent: tabela com API real, loading/empty/error/retry e cancelamento das consultas ao desmontar.
- Pedidos e Dashboard compartilham o badge; demais módulos continuam usando contratos comuns de superfície, tipografia, formulário e botões.
- Sem mudança no contrato da API, nas transições de status, preços ou no atendimento.

## Mapeamento para o domínio

Cards, buttons, fields, tabelas e ícones → componentes/contratos reutilizáveis.
Vendas, produtos e clientes do template → dados existentes de pedidos, cardápio e clientes.
Calendários, invoices, tasks, login e telas demonstrativas → não adicionados automaticamente.
Dashboard prioriza situação operacional, faturamento de hoje, ticket e pedidos recentes; análises detalhadas seguem abaixo.
Status Novo/Pronto não existem no contrato atual. Não criar estado nem atribuir contagem artificial; pendente/confirmado/em_preparo/saiu_para_entrega/entregue/cancelado são preservados.
Atendimento permanece módulo de atendimento, sem inventar histórico de mensagens ou ações humanas ausentes.

## Contexto multi-restaurante

A busca neste checkout não encontrou RestauranteId/restaurante_id, modelo Restaurante, seleção de restaurante ou isolamento tenant nas migrations/controllers/modelos. A referência enviada chama o sistema de restaurante-ricardo-familia; o checkout atual é restaurante-ricardo-whatsapp. Não afirmar suporte multi-restaurante existente nem introduzir seletor falso. Arquitetura e escopo atuais preservados. Caso o projeto multi-restaurante seja outro checkout, aplicar componentes por contexto e revisar endpoints antes de integração.

## Acessibilidade

Foco visível, labels de ações, texto de status independente de cor, scroll horizontal de tabelas, layout móvel e respeito a prefers-reduced-motion. Estados indisponíveis não são preenchidos com dados demonstrativos. O status real da conexão Meta não possui endpoint de saúde; sidebar passa a informar somente a integração, sem afirmar conexão ativa.

Indicadores (seção 21 do ANDAMENTO): conversão usa anel SVG inspirado nos gráficos circulares de Design System → Charts, node 950-3111; tempos usam barras arredondadas com tokens roxo/rosa/verde e trilhas elevadas. São adaptações aos dados reais, sem exportação autenticada ou equivalência pixel a pixel. Evitar accent-color como única estilização de meter nativo.
