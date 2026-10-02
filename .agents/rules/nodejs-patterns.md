# Regra: Node.js, Segurança & Padrões Backend

## 1. Concorrência e Resiliência
- **Gerenciamento de Filas por Entidade:** Requisições assíncronas do mesmo cliente (ex: WhatsApp ID) devem ser enfileiradas para prevenir condições de corrida (*race conditions*) sobre estado ou memória compartilhada.
- **Deduplicação de Eventos:** Webhooks externos (ex: Meta) podem reenviar a mesma mensagem múltiplas vezes. Manter cache de IDs de mensagens processadas (`Set` com limite de tamanho/LRU).
- **Timeouts e Retries Exponenciais:** Chamadas para APIs externas (LLMs, WhatsApp Graph API, impressoras de rede) devem possuir timeouts explícitos e tratamento para erros de rede transitórios (`429`, `503`).

## 2. Segurança e Validação
- **Validação Criptográfica de Webhooks:** Toda requisição recebida em rotas públicas de webhook deve validar a assinatura HMAC (`x-hub-signature-256`) com `timingSafeEqual`.
- **Sanitização de Entradas:** Validar rigorosamente argumentos de ferramentas antes de executar ações de gravação ou chamada a banco de dados.
- **Proteção de Variáveis Sensíveis:** Chaves de API, segredos e tokens devem sempre residir exclusivamente no `.env`, nunca hardcoded no código ou logs.

## 3. Logs Estruturados & Observabilidade
- **Rastreabilidade de Conversas:** Gravar histórico de passos, ferramentas acionadas e tempo de resposta em arquivo de log estruturado (JSONL) para auditoria e depuração de comportamentos do modelo.
- **Logs Limpos:** Erros operacionais devem conter mensagens contextuais com indicação clara da causa raiz.
