import { cabecalhosApiBot } from './lib/api-bot.js';
// pedidos.js: Gerenciamento, persistência, consulta na tabela de pedidos e formatação de comandas
import { converterValor, validarItensTotal } from './lib/pedido.js';
export { converterValor } from './lib/pedido.js';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { lerJson, gravarJson } from './lib/persistencia.js';

const ARQ_PEDIDOS = process.env.ARQ_PEDIDOS || fileURLToPath(new URL('./pedidos.json', import.meta.url));

export const carregarPedidos = () => lerJson(ARQ_PEDIDOS);
export const salvarPedidos = (dados) => gravarJson(ARQ_PEDIDOS, dados);

export function gerarIdPedido() {
  const agora = new Date();
  const dia = String(agora.getDate()).padStart(2, '0');
  const rand = Math.floor(100 + Math.random() * 900); // 3 dígitos
  return `PED-${dia}-${rand}`; // ex: PED-03-742
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
  const encontrados = Object.values(pedidos).filter((p) => p.telefone && String(p.telefone).replace(/\D/g, '').replace(/^00/, '') === telLimpo);
  return encontrados.sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora))[0] || null;
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

/**
 * Registra o pedido na tabela, consulta o registro oficial, gera a comanda para a cozinha
 * e gera a mensagem oficial para o cliente.
 */
export async function registrarPedido({ id, telefone, nome, itens, endereco, formaPagamento, trocoPara, total, observacoes }) {
  if (typeof telefone !== 'string' || !/^\d{10,15}$/.test(telefone) || !nome?.trim() || !endereco?.trim() || !formaPagamento?.trim() || !Array.isArray(itens) || !itens.length || itens.some(i => typeof i !== 'string' || !i.trim())) throw new Error('Pedido incompleto ou inválido');
  if (nome.length > 150 || endereco.length > 255 || itens.length > 100) throw new Error('Pedido excede os limites permitidos');
  validarItensTotal(itens, total);
  const valor = converterValor(total);
  if (valor < 25 && !/retirada|balc[aã]o/i.test(endereco)) throw new Error('Pedido mínimo para entrega: R$ 25,00');
  if (valor <= 0) throw new Error('Total do pedido inválido');
  if (trocoPara && converterValor(trocoPara) < valor) throw new Error('O valor para troco não cobre o pedido');
  const pedidos = carregarPedidos();
  const novoId = id || gerarIdPedido();

  if (pedidos[novoId]) throw new Error('Número do pedido já registrado');
  const pedido = {
    id: novoId,
    dataHora: new Date().toISOString(),
    status: 'Em preparo',
    sincronizado: false,
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

  await sincronizarPedido(pedido);

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
export async function consultarStatusPedido(idOuTelefone, telefoneCliente) {
  if (!idOuTelefone) return { erro: 'Informe o número do pedido ou seu telefone.' };

  const idLimpo = String(idOuTelefone).trim();
  let pedido = obterPedidoPorId(idLimpo);

  if (!pedido) {
    pedido = obterUltimoPedidoPorTelefone(idLimpo);
  }

  if (telefoneCliente) {
    try {
      const parametros = new URLSearchParams({ telefone: telefoneCliente });
      if (/^PED-/i.test(idLimpo)) parametros.set('codigo_pedido', idLimpo);
      const resposta = await fetch(`${process.env.API_BASE_URL || 'http://127.0.0.1:8080/api'}/pedidos/consulta/bot?${parametros}`, { headers: cabecalhosApiBot(), signal: AbortSignal.timeout(5000) });
      if (resposta.ok) {
        const { pedido: remoto } = await resposta.json();
        if (remoto) pedido = { id: remoto.codigo_pedido, telefone: remoto.cliente.telefone, nome: remoto.cliente.nome, status: remoto.status, dataHora: remoto.created_at, endereco: remoto.endereco?.logradouro || 'Retirada no balcão', total: `R$ ${remoto.valor_total}`, itens: remoto.itens.map(i => ({ nome: i.nome_snapshot, qtd: i.quantidade, tamanho: i.tamanho_snapshot, preco: i.preco_unitario })) };
      } else if (resposta.status === 404) { pedido = null; }
    } catch (erro) { console.warn('Consulta usando registro local:', erro.message); }
  }
  if (pedido && telefoneCliente && String(pedido.telefone).replace(/\D/g, '') !== String(telefoneCliente).replace(/\D/g, '')) pedido = null;

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
    mensagemStatus: 'Não encontrei nenhum pedido em andamento com os dados informados. 🔍\nPara falar com nossa equipe, ligue para (12) 99750-0045.',
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


async function sincronizarPedido(pedido) {
  try {
    const resposta = await fetch(`${process.env.API_BASE_URL || 'http://127.0.0.1:8080/api'}/pedidos`, {
      method: 'POST', signal: AbortSignal.timeout(5000),
      headers: { ...cabecalhosApiBot(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...pedido, codigo_pedido: pedido.id }),
    });
    if (!resposta.ok) throw new Error(`API de pedidos retornou ${resposta.status}`);
    const atuais = carregarPedidos();
    if (atuais[pedido.id]) {
      atuais[pedido.id].sincronizado = true;
      delete atuais[pedido.id].erroSincronizacao;
      salvarPedidos(atuais);
    }
    return true;
  } catch (erro) {
    const atuais = carregarPedidos();
    if (atuais[pedido.id]) {
      atuais[pedido.id].erroSincronizacao = erro.message;
      salvarPedidos(atuais);
    }
    console.error('Pedido salvo localmente; sincronização pendente:', pedido.id, erro.message);
    return false;
  }
}

let sincronizacaoEmCurso = null;
export function sincronizarPedidosPendentes() {
  if (sincronizacaoEmCurso) return sincronizacaoEmCurso;
  sincronizacaoEmCurso = (async () => {
    for (const pedido of Object.values(carregarPedidos())) {
      if (pedido.sincronizado === false) await sincronizarPedido(pedido);
    }
  })().finally(() => { sincronizacaoEmCurso = null; });
  return sincronizacaoEmCurso;
}
