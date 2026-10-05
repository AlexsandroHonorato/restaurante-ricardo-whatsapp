// Perfis de atendimento por tipo de negócio (Configurações → Dados da empresa).
// Os códigos de etapa (fazendo_pedido_pratos, coletando_endereco...) são os mesmos em todos os perfis:
// o painel e os relatórios continuam funcionando; mudam só vocabulário e etapas do prompt.
const PERFIS = {
  restaurante: {
    estabelecimento: 'o restaurante',
    rotulo: 'RESTAURANTE',
    artigo: 'DO',
    catalogo: 'cardápio',
    itens: 'pratos',
    emoji: '🍽️',
    destino: 'a cozinha',
    apresentarCatalogo: 'apresente as opções do cardápio do dia com preços e tamanhos consultados da tabela abaixo.',
    etapaItens: `Se status for 'fazendo_pedido_pratos':
   - O cliente está escolhendo pratos principais/porções e tamanhos (Infantil, Médio, Grande).
   - Confirme o prato e o tamanho escolhido. Pergunte se deseja adicionar mais algum prato ou se pode avançar para as bebidas.
   - Quando os pratos estiverem definidos, use a ferramenta 'atualizar_status_conversa' com status 'fazendo_pedido_bebidas' e apresente a lista de bebidas.`,
    etapaBebidas: `Se status for 'fazendo_pedido_bebidas':
   - O cliente já escolheu os pratos e agora deve escolher as bebidas (Refrigerantes, Sucos, Água, Cervejas) ou informar que não deseja bebidas.
   - Assim que as bebidas forem definidas ou dispensadas, use 'atualizar_status_conversa' com status 'coletando_endereco' e solicite o endereço completo de entrega (Rua, Número, Bairro, CEP/Ponto de Referência e Nome).`,
    jaEscolheu: 'O cliente já escolheu pratos e bebidas.',
  },
  loja: {
    estabelecimento: 'a loja',
    rotulo: 'LOJA',
    artigo: 'DA',
    catalogo: 'catálogo',
    itens: 'produtos',
    emoji: '🛍️',
    destino: 'a separação',
    apresentarCatalogo: 'apresente as opções do catálogo com preços e variações consultados da tabela abaixo.',
    etapaItens: `Se status for 'fazendo_pedido_pratos':
   - O cliente está escolhendo produtos (e variações/tamanhos, quando houver).
   - Confirme cada produto, variação e quantidade. Pergunte se deseja adicionar mais algum produto.
   - Quando os produtos estiverem definidos, use a ferramenta 'atualizar_status_conversa' com status 'coletando_endereco' e solicite o endereço completo de entrega (Rua, Número, Bairro, CEP/Ponto de Referência e Nome) ou se prefere retirar na loja.`,
    etapaBebidas: null,
    jaEscolheu: 'O cliente já escolheu os produtos.',
  },
};

export const TIPOS_NEGOCIO = Object.keys(PERFIS);

export function perfilNegocio(tipo) {
  return PERFIS[tipo] || PERFIS.restaurante;
}
