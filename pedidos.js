import { cabecalhosApiBot } from './lib/api-bot.js';
// pedidos.js: registro e consulta de pedidos pela API (MySQL é a única tabela de pedidos) e formatação de comandas.
import { EMPRESA } from './lib/empresa.js';

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
    `👨‍🍳 O seu pedido foi registrado e está em preparação!\n` +
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

const reais = valor => Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Grava na API, que busca preço/disponibilidade pelo código e calcula total, troco e mínimo de entrega. */
async function gravarNaApi(corpo) {
  let resposta;
  try {
    resposta = await fetch(`${process.env.API_BASE_URL || 'http://127.0.0.1:8080/api'}/pedidos`, {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { ...cabecalhosApiBot(), 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
  } catch (erro) {
    console.error('API de pedidos inacessível:', erro.message);
    resposta = null;
  }
  const dados = resposta ? await resposta.json().catch(() => ({})) : {};
  if (resposta?.status === 422) {
    // Motivo legível (item pausado, fora do dia, mínimo, troco) para a IA explicar ao cliente.
    throw new Error(Object.values(dados.errors || {}).flat()[0] || dados.message || 'Pedido recusado pelo sistema.');
  }
  if (!resposta?.ok || !dados.pedido) {
    throw new Error('Sistema de pedidos indisponível no momento; o pedido NÃO foi registrado. Oriente o cliente a ligar para a loja.');
  }
  return dados.pedido;
}

/**
 * Registra o pedido pela API (fonte de verdade de preços), guarda cópia local para consultas,
 * gera a comanda para a cozinha e a mensagem oficial para o cliente.
 * Cada item é { codigo, quantidade }: o código "[cod N]" de um tamanho no cardápio.
 */
export async function registrarPedido({ telefone, nome, itens, endereco, formaPagamento, trocoPara, observacoes, chave }) {
  const itemValido = i => i && Number.isInteger(i.codigo) && i.codigo > 0 && Number.isInteger(i.quantidade) && i.quantidade >= 1 && i.quantidade <= 100;
  if (typeof telefone !== 'string' || !/^\d{10,15}$/.test(telefone) || !nome?.trim() || !endereco?.trim() || !formaPagamento?.trim() || !Array.isArray(itens) || !itens.length || !itens.every(itemValido)) {
    throw new Error('Pedido incompleto: informe nome, endereço, pagamento e cada item com o código [cod N] do cardápio e a quantidade.');
  }
  if (nome.length > 150 || endereco.length > 255 || itens.length > 100) throw new Error('Pedido excede os limites permitidos');
  // O servidor gera o código do pedido; a chave (id da mensagem) impede pedido em dobro se ela for reprocessada.
  const remoto = await gravarNaApi({
    telefone, nome: nome.trim(), endereco: endereco.trim(), formaPagamento,
    trocoPara: trocoPara || null, observacoes: observacoes || null, chave_idempotencia: chave || null,
    itens: itens.map(i => ({ variacao_id: i.codigo, quantidade: i.quantidade })),
  });
  const pedido = {
    id: remoto.codigo_pedido,
    dataHora: remoto.created_at,
    status: 'Em preparo',
    telefone,
    nome: remoto.cliente?.nome || nome,
    itens: remoto.itens.map(i => ({ nome: i.nome_snapshot, tamanho: i.tamanho_snapshot, qtd: i.quantidade, preco: reais(i.preco_unitario) })),
    endereco: remoto.endereco?.logradouro || endereco,
    formaPagamento,
    trocoPara: remoto.troco_para ? reais(remoto.troco_para) : null,
    total: `R$ ${reais(remoto.valor_total)}`,
    observacoes: observacoes || '',
  };

  // A impressão física sai pelo painel da cozinha (Pedidos → Comanda / impressão automática).
  const comanda = formatarComanda(pedido);

  return {
    ok: true,
    id: pedido.id,
    status: pedido.status,
    tempoEstimado: '40 a 60 minutos',
    comanda,
    mensagemCliente: formatarMensagemConfirmacaoCliente(pedido),
    pedido,
  };
}

/**
 * Consulta a tabela de pedidos por ID ou Telefone e formata a resposta direta
 */
export async function consultarStatusPedido(idOuTelefone, telefoneCliente) {
  if (!idOuTelefone) return { erro: 'Informe o número do pedido ou seu telefone.' };

  const idLimpo = String(idOuTelefone).trim();
  let pedido = null;
  try {
    // Sempre filtrado pelo telefone de quem pergunta: ninguém consulta pedido de outra pessoa.
    const parametros = new URLSearchParams({ telefone: telefoneCliente });
    if (/^PED-/i.test(idLimpo)) parametros.set('codigo_pedido', idLimpo);
    const resposta = await fetch(`${process.env.API_BASE_URL || 'http://127.0.0.1:8080/api'}/pedidos/consulta/bot?${parametros}`, { headers: cabecalhosApiBot(), signal: AbortSignal.timeout(5000) });
    if (!resposta.ok && resposta.status !== 404) throw new Error(`API retornou ${resposta.status}`);
    const remoto = resposta.ok ? (await resposta.json()).pedido : null;
    if (remoto) pedido = { id: remoto.codigo_pedido, telefone: remoto.cliente.telefone, nome: remoto.cliente.nome, status: remoto.status, dataHora: remoto.created_at, endereco: remoto.endereco?.logradouro || 'Retirada no balcão', total: `R$ ${reais(remoto.valor_total)}`, itens: remoto.itens.map(i => ({ nome: i.nome_snapshot, qtd: i.quantidade, tamanho: i.tamanho_snapshot, preco: reais(i.preco_unitario) })) };
  } catch (erro) {
    console.warn('Consulta de pedido indisponível:', erro.message);
    return {
      aviso: 'Não foi possível consultar a tabela de pedidos agora.',
      mensagemStatus: `Desculpe, não consegui consultar seu pedido agora. 🙏\nTente de novo em alguns minutos ou ligue para ${EMPRESA.telefone}.`,
    };
  }
  if (pedido && String(pedido.telefone).replace(/\D/g, '') !== String(telefoneCliente).replace(/\D/g, '')) pedido = null;

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
    mensagemStatus: `Não encontrei nenhum pedido em andamento com os dados informados. 🔍\nPara falar com nossa equipe, ligue para ${EMPRESA.telefone}.`,
  };
}

export function formatarComanda(pedido) {
  const linha = '================================';
  const itensStr = Array.isArray(pedido.itens)
    ? pedido.itens.map((i) => ` - ${typeof i === 'string' ? i : `${i.qtd || 1}x ${i.nome} (${i.tamanho || 'Padrão'}) ${i.preco ? `- R$ ${i.preco}` : ''}`}`).join('\n')
    : pedido.itens;

  return `
${linha}
   ${EMPRESA.nome.toUpperCase()}
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
