// pedidos.js: Gerenciamento, persistência, consulta na tabela de pedidos e formatação de comandas
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const ARQ_PEDIDOS = 'pedidos.json';

export function carregarPedidos() {
  if (!existsSync(ARQ_PEDIDOS)) return {};
  try {
    return JSON.parse(readFileSync(ARQ_PEDIDOS, 'utf8'));
  } catch {
    return {};
  }
}

export function salvarPedidos(pedidos) {
  writeFileSync(ARQ_PEDIDOS, JSON.stringify(pedidos, null, 2), 'utf8');
}

export function gerarIdPedido() {
  const agora = new Date();
  const dia = String(agora.getDate()).padStart(2, '0');
  const hora = String(agora.getHours()).padStart(2, '0');
  const min = String(agora.getMinutes()).padStart(2, '0');
  const rand = Math.floor(100 + Math.random() * 900);
  return `PED-${dia}${hora}${min}-${rand}`;
}

/**
 * Consulta um pedido específico diretamente na tabela de pedidos por ID
 */
export function obterPedidoPorId(id) {
  const pedidos = carregarPedidos();
  if (!id) return null;
  return pedidos[String(id).trim()] || null;
}

/**
 * Consulta o último pedido registrado para um determinado telefone
 */
export function obterUltimoPedidoPorTelefone(telefone) {
  const pedidos = carregarPedidos();
  if (!telefone) return null;
  const telLimpo = String(telefone).replace(/\D/g, '');
  const encontrados = Object.values(pedidos).filter((p) => p.telefone && String(p.telefone).replace(/\D/g, '').includes(telLimpo));
  return encontrados.length > 0 ? encontrados.at(-1) : null;
}

/**
 * Formata a mensagem oficial de confirmação do pedido consultado na tabela para envio direto ao cliente
 */
export function formatarMensagemConfirmacaoCliente(pedido) {
  const itensFormatados = Array.isArray(pedido.itens)
    ? pedido.itens.map((i) => `• ${typeof i === 'string' ? i : `${i.qtd || 1}x ${i.nome} (${i.tamanho || 'Padrão'}) ${i.preco ? `- R$ ${i.preco}` : ''}`}`).join('\n')
    : `• ${pedido.itens}`;

  const dataHoraFmt = new Date(pedido.dataHora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  return `🎉 *PEDIDO CONFIRMADO COM SUCESSO!* 🍽️\n\n` +
    `📋 *Número do Pedido:* \`${pedido.id}\`\n` +
    `📅 *Data/Hora:* ${dataHoraFmt}\n` +
    `👤 *Cliente:* ${pedido.nome}\n` +
    `📍 *Endereço:* ${pedido.endereco}\n\n` +
    `🛒 *Itens Registrados:*\n${itensFormatados}\n\n` +
    `💳 *Pagamento:* ${pedido.formaPagamento}${pedido.trocoPara ? ` (Troco para R$ ${pedido.trocoPara})` : ''}\n` +
    `💰 *Valor Total:* ${pedido.total}\n` +
    `⏳ *Previsão de Entrega:* 40 a 60 minutos\n\n` +
    `👨‍🍳 O seu pedido já foi impresso na nossa cozinha e está em preparação!\n` +
    `Para consultar o andamento a qualquer momento, basta enviar: *status do pedido*.\n\n` +
    `Agradecemos a sua preferência! 😊`;
}

/**
 * Formata a mensagem oficial de consulta de status consultada na tabela de pedidos
 */
export function formatarMensagemStatusCliente(pedido) {
  const itensFormatados = Array.isArray(pedido.itens)
    ? pedido.itens.map((i) => `• ${typeof i === 'string' ? i : `${i.qtd || 1}x ${i.nome}`}`).join('\n')
    : `• ${pedido.itens}`;

  const dataHoraFmt = new Date(pedido.dataHora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  return `📋 *SITUAÇÃO DO SEU PEDIDO* 🍽️\n\n` +
    `• *Número do Pedido:* \`${pedido.id}\`\n` +
    `• *Status Atual:* *${pedido.status}*\n` +
    `• *Horário do Pedido:* ${dataHoraFmt}\n` +
    `• *Itens:* \n${itensFormatados}\n` +
    `• *Endereço:* ${pedido.endereco}\n` +
    `• *Total:* ${pedido.total}\n\n` +
    `⏳ *Tempo estimado total:* 40 a 60 minutos.\n` +
    `Qualquer dúvida estamos à disposição! 😊`;
}

/**
 * Registra o pedido na tabela, consulta o registro oficial, gera a comanda para a cozinha
 * e gera a mensagem oficial para o cliente.
 */
export function registrarPedido({ id, telefone, nome, itens, endereco, formaPagamento, trocoPara, total, observacoes }) {
  const pedidos = carregarPedidos();
  const novoId = id || gerarIdPedido();

  const pedido = {
    id: novoId,
    dataHora: new Date().toISOString(),
    status: 'Em preparo',
    telefone,
    nome: nome || 'Cliente',
    itens: itens || [],
    endereco: endereco || 'Retirada no balcão',
    formaPagamento: formaPagamento || 'A combinar',
    trocoPara: trocoPara || null,
    total: total || 'A calcular',
    observacoes: observacoes || '',
  };

  // Salva no banco de pedidos
  pedidos[novoId] = pedido;
  salvarPedidos(pedidos);

  // Sincroniza em tempo real com o banco de dados MySQL via API Laravel
  try {
    fetch('http://127.0.0.1:8080/api/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        codigo_pedido: novoId,
        telefone,
        nome,
        itens: Array.isArray(itens) ? itens : [itens],
        endereco,
        formaPagamento,
        trocoPara,
        total,
        observacoes,
      }),
    }).catch(() => {});
  } catch { /* não bloqueia a resposta se a API estiver ocupada */ }

  // Consulta o pedido diretamente da tabela para garantir consistência
  const pedidoConsultado = obterPedidoPorId(novoId) || pedido;

  // Imprime a comanda térmica para a cozinha
  const comanda = formatarComanda(pedidoConsultado);
  imprimirComanda(comanda);

  // Gera a mensagem direta para a tela do cliente a partir da tabela
  const mensagemCliente = formatarMensagemConfirmacaoCliente(pedidoConsultado);

  return {
    ok: true,
    id: novoId,
    status: pedidoConsultado.status,
    tempoEstimado: '40 a 60 minutos',
    comanda,
    mensagemCliente,
    pedido: pedidoConsultado,
  };
}

/**
 * Consulta a tabela de pedidos por ID ou Telefone e formata a resposta direta
 */
export function consultarStatusPedido(idOuTelefone) {
  if (!idOuTelefone) return { erro: 'Informe o número do pedido ou seu telefone.' };

  const idLimpo = String(idOuTelefone).trim();
  let pedido = obterPedidoPorId(idLimpo);

  if (!pedido) {
    pedido = obterUltimoPedidoPorTelefone(idLimpo);
  }

  if (pedido) {
    const mensagemStatus = formatarMensagemStatusCliente(pedido);
    return {
      ok: true,
      id: pedido.id,
      status: pedido.status,
      itens: pedido.itens,
      dataHora: pedido.dataHora,
      nome: pedido.nome,
      mensagemStatus,
    };
  }

  return {
    aviso: 'Pedido não localizado automaticamente na nossa tabela de pedidos. Encaminhando para um atendente humano.',
    mensagemStatus: 'Não encontrei nenhum pedido em andamento com os dados informados. 🔍\nUm de nossos atendentes foi avisado e vai te responder por aqui!',
  };
}

export function formatarComanda(pedido) {
  const linha = '================================';
  const itensStr = Array.isArray(pedido.itens)
    ? pedido.itens.map((i) => ` - ${typeof i === 'string' ? i : `${i.qtd || 1}x ${i.nome} (${i.tamanho || 'Padrão'}) ${i.preco ? `- R$ ${i.preco}` : ''}`}`).join('\n')
    : pedido.itens;

  return `
${linha}
   RESTAURANTE FAMÍLIA RICARDO
        COMANDA DE PEDIDO
${linha}
Nº PEDIDO: ${pedido.id}
DATA/HORA: ${new Date(pedido.dataHora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
STATUS:    ${pedido.status}
CLIENTE:   ${pedido.nome}
TELEFONE:  ${pedido.telefone}
${linha}
ITENS DO PEDIDO:
${itensStr}
${linha}
ENDEREÇO DE ENTREGA:
${pedido.endereco}
${linha}
PAGAMENTO: ${pedido.formaPagamento}${pedido.trocoPara ? ` (Troco para R$ ${pedido.trocoPara})` : ''}
TOTAL:     ${pedido.total}
${pedido.observacoes ? `OBS:       ${pedido.observacoes}\n` : ''}${linha}
`;
}

export function imprimirComanda(textoComanda) {
  console.log(`\n🖨️ [IMPRESSORA DE PEDIDOS / COZINHA]\n${textoComanda}\n`);
}

