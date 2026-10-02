# Regra: Web Design, UI/UX & Design Systems

## 1. Princípios de Experiência Visual (UI/UX)
- **Primeira Impressão Marcante:** Interfaces devem transmitir acabamento profissional, contemporâneo e polido (evitar layouts genéricos ou aparência de rascunho/MVP básico).
- **Tipografia Moderna:** Uso prioritário de fontes limpas e legíveis (Inter, Outfit, Plus Jakarta Sans, Roboto) com hierarquia clara de títulos, subtítulos e textos corridos.
- **Paleta de Cores Curada:** 
  - Cores semânticas bem dosadas (sucesso, alerta, erro, neutros balanceados).
  - Suporte a Dark Mode / Light Mode com contraste adequado (WCAG 2.1 AA mínimo).
  - Uso elegante de gradientes sutis, sombras suaves (`box-shadow` refinadas) e glassmorphism (`backdrop-filter`).

## 2. Interatividade & Micro-Animações
- **Feedback Imediato:** Qualquer ação do usuário (clique, submit, cópia, hover) deve fornecer resposta visual clara (mudança de estado, spinner, toast de confirmação).
- **Transições Suaves:** `transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1)` para evitar mudanças abruptas de estado.
- **Responsividade Mobile-First:** Todo layout deve ser totalmente utilizável em telas pequenas (smartphones), médias (tablets) e grandes (desktops).

## 3. Estrutura de Componentes
- **Atomicidade e Reutilização:** Componentes isolados e independentes (Cards de Pedido, Badges de Status, Modais de Confirmação, Botões de Ação).
- **Acessibilidade (a11y):** Labels adequadas, suporte a navegação por teclado (`Tab`, `Enter`, `Esc`) e contraste de cores legível.
- **Sem Placeholders:** Utilize ícones vetoriais nítidos (SVG / Lucide / Phosphor) e dados simulados realistas.
