# Diretrizes de Atendimento e Padrões Globais (AGENTS.md)

## 📌 1. Regra de Contexto e Continuidade (ANDAMENTO.md)
- **Sempre ler `ANDAMENTO.md` no início da conversa:** Antes de propor alterações ou responder sobre o projeto, leia o arquivo `ANDAMENTO.md` para carregar o histórico consolidado, stack, arquivos e regras de negócio.
- **Manter `ANDAMENTO.md` atualizado:** Sempre que houver mudanças relevantes no projeto (novos fluxos, regras de negócio, novas ferramentas ou integrações), atualize o `ANDAMENTO.md` no final.

## 📌 2. Pacote Obrigatório de Regras Padrão para Todo Projeto
Todo projeto iniciado deve conter e seguir obrigatoriamente as regras em `.agents/rules/`:
1. **`clean-architecture.md`**: Princípios SOLID, desacoplamento em camadas (Domínio, Casos de Uso, Adaptadores, Infra) e código limpo.
2. **`nodejs-patterns.md`**: Segurança (webhooks, validação criptográfica HMAC), resiliência de filas e logs estruturados.
3. **`web-design-system.md`**: Padrões visuais premium de UI/UX, Design System, micro-animações, responsividade e acessibilidade.
4. **`andamento.md`**: Gestão do arquivo de memória e contexto contínuo.
