# Regra: Clean Architecture & Princípios de Engenharia de Software

## 1. Princípios Fundamentais
- **Princípio da Responsabilidade Única (SRP):** Cada módulo, classe ou função deve ter uma única razão para mudar.
- **Inversão de Dependência (DIP):** Módulos de alto nível não devem depender de módulos de baixo nível. Ambos devem depender de abstrações.
- **Separação de Preocupações (SoC):** Regras de negócio, persistência de dados e interfaces de comunicação devem residir em camadas isoladas.

## 2. Estrutura de Camadas Recomendada
1. **Domínio / Entidades:**
   - Modelos de dados e regras de negócio invariantes (ex: cálculo de totais, validação de limites de pedidos, regras de troco).
   - Não depende de bibliotecas externas, frameworks ou bancos de dados.
2. **Casos de Uso / Serviços da Aplicação:**
   - Orquestra o fluxo de dados entre entidades e adaptadores externos (ex: fluxo de fechar pedido, verificação de disponibilidade, consulta de status).
3. **Adaptadores de Interface / Controllers:**
   - Converte dados do formato mais conveniente para os casos de uso (ex: webhook da Meta, comandos CLI do simulador).
4. **Infraestrutura / Frameworks:**
   - Implementações concretas de I/O: chamadas HTTP à API do WhatsApp, gravação em arquivos/banco de dados, comunicação com impressoras de pedidos (ESC/POS).

## 3. Práticas de Código Limpo (Clean Code)
- **Funções Pequenas e Puras:** Prefira funções focadas, com poucos argumentos e sem efeitos colaterais ocultos.
- **Tratamento de Erros Explícito:** Evite `try/catch` silenciosos. Capture exceções e devolva respostas estruturadas `{ ok: false, erro: string }`.
- **Nomenclatura Descritiva:** Nomes de variáveis e funções devem expressar claramente o que fazem sem necessidade de comentários óbvios.
- **Imutabilidade e Idempotência:** Operações de agendamento e pagamento devem prever chaves de idempotência para evitar duplicidade em webhooks.
