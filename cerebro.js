// cerebro.js: memória + ficha do negócio + modelo (OpenRouter) + máquina de estados + ferramentas de pedidos.
import { fileURLToPath } from 'node:url';
import { readFileSync, appendFileSync } from 'node:fs';
import { criarFilaPorChave } from './lib/fila.js';
import { lerJson, gravarJson } from './lib/persistencia.js';
import { registrarPedido, consultarStatusPedido } from './pedidos.js';

const FUSO = process.env.FUSO || 'America/Sao_Paulo';
const MODELO = process.env.MODELO || 'google/gemini-3.7-flash';
const MAX_MENSAGENS = 20;              // quantas mensagens da conversa voltam para o modelo
const EXPIRA_MINUTOS_INATIVIDADE = 30;   // inatividade de 30 min antes de fechar o pedido expira e volta ao início
const ARQ_MEMORIA = process.env.ARQ_MEMORIA || fileURLToPath(new URL('./memoria.json', import.meta.url));
const FICHA = readFileSync(new URL('./negocio.md', import.meta.url), 'utf8');
const INFORMACOES_NEGOCIO = FICHA.split(/(?=^## )/m)
  .filter(secao => /^## (Quem somos|Horários|Endereço|Formas|Políticas)/m.test(secao)).join('\n');

// ---------------------------------------------------------------- status conversacionais
export const STATUS_CONVERSA = {
  INICIADA: 'conversa_iniciada',
  PRATOS: 'fazendo_pedido_pratos',
  BEBIDAS: 'fazendo_pedido_bebidas',
  ENDERECO: 'coletando_endereco',
  PAGAMENTO: 'coletando_pagamento',
  COZINHA: 'preparando_na_cozinha',
  ENTREGA: 'saiu_para_entrega',
  CANCELADO_30MIN: 'cancelado_apos_30_minutos',
};

// ---------------------------------------------------------------- memória com máquina de estados
export const memoria = lerJson(ARQ_MEMORIA);
let salvando = null;
function salvarMemoria() {
  clearTimeout(salvando);
  salvando = setTimeout(() => gravarJson(ARQ_MEMORIA, memoria), 300);
}

const filasSincronizacao = new Map();
export function sincronizarStatusBanco(tel, status, rascunho = {}, extras = {}) {
  const corpo = JSON.stringify({
    telefone: tel, status: status || STATUS_CONVERSA.INICIADA, rascunho: rascunho || {},
    transbordo: extras.transbordo || false, motivo_transbordo: extras.motivo_transbordo || null,
    nome: extras.nome || null, expirou: extras.expirou || false,
    registrar_mensagem: extras.registrar_mensagem || false,
    etapa_abandono: extras.etapa_abandono || null,
  });
  const anterior = filasSincronizacao.get(tel) || Promise.resolve();
  const tarefa = anterior.catch(() => {}).then(async () => {
    try {
      const resposta = await fetch(`${process.env.API_BASE_URL || 'http://127.0.0.1:8080/api'}/status-conversa/sync`, {
        signal: AbortSignal.timeout(5000), method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: corpo,
      });
      if (!resposta.ok) throw new Error(`API de status retornou ${resposta.status}`);
    } catch (erro) { console.warn('Falha ao sincronizar conversa:', tel, erro.message); }
  });
  filasSincronizacao.set(tel, tarefa);
  tarefa.finally(() => { if (filasSincronizacao.get(tel) === tarefa) filasSincronizacao.delete(tel); }).catch(() => {});
  return tarefa;
}

export function obterEstadoCliente(tel) {
  if (typeof tel !== 'string' || !/^\d{10,15}$/.test(tel)) throw new Error('Telefone inválido');
  let c = memoria[tel];
  if (!c) {
    c = {
      status: STATUS_CONVERSA.INICIADA,
      rascunho: { pratos: [], bebidas: [], endereco: null, formaPagamento: null, trocoPara: null, total: null },
      atualizado: Date.now(),
      msgs: [],
    };
    memoria[tel] = c;
    salvarMemoria();
    sincronizarStatusBanco(tel, c.status, c.rascunho);
    return c;
  }

  // Garante propriedades em chaves legadas
  if (!c.status) c.status = STATUS_CONVERSA.INICIADA;
  if (!c.rascunho) c.rascunho = { pratos: [], bebidas: [], endereco: null, formaPagamento: null, trocoPara: null, total: null };
  if (!c.msgs) c.msgs = [];

  // Verifica tempo de inatividade
  const tempoInativoMs = Date.now() - (c.atualizado || 0);
  const expirou30Min = tempoInativoMs >= EXPIRA_MINUTOS_INATIVIDADE * 60 * 1000;

  const pedidoEmAndamento = [
    STATUS_CONVERSA.PRATOS,
    STATUS_CONVERSA.BEBIDAS,
    STATUS_CONVERSA.ENDERECO,
    STATUS_CONVERSA.PAGAMENTO,
  ].includes(c.status);

  // Se ficou inativo por mais de 30 minutos antes de fechar o pedido, cancela e volta ao início
  if (expirou30Min && pedidoEmAndamento) {
    console.log(`⏱️ [INATIVIDADE 30 MIN] Tel: ${tel} | Cancelando status '${c.status}' e retornando ao início.`);
    c.statusAnterior = c.status;
    c.status = STATUS_CONVERSA.INICIADA;
    c.rascunho = { pratos: [], bebidas: [], endereco: null, formaPagamento: null, trocoPara: null, total: null };
    c.msgs = [];
    c.atualizado = Date.now();
    salvarMemoria();
    sincronizarStatusBanco(tel, STATUS_CONVERSA.INICIADA, c.rascunho, { expirou: true, etapa_abandono: c.statusAnterior });
  }

  return c;
}

export function atualizarStatusCliente(tel, novoStatus, dadosRascunho = {}, extras = {}) {
  const c = obterEstadoCliente(tel);
  if (!Object.values(STATUS_CONVERSA).includes(novoStatus)) throw new Error('Status conversacional inválido');
  c.status = novoStatus;
  c.rascunho = { ...(c.rascunho || {}), ...Object.fromEntries(Object.entries(dadosRascunho).filter(([, valor]) => valor !== undefined)) };
  c.atualizado = Date.now();
  memoria[tel] = c;
  salvarMemoria();
  sincronizarStatusBanco(tel, novoStatus, c.rascunho, extras);
  return c;
}

export function historico(tel) {
  const c = obterEstadoCliente(tel);
  return c.msgs || [];
}

export function limparMemoria(tel) {
  delete memoria[tel];
  salvarMemoria();
}

export function lembrar(tel, role, content, timestamp = Date.now()) {
  const c = obterEstadoCliente(tel);
  const msgs = [...(c.msgs || []), { role, content }].slice(-MAX_MENSAGENS);
  c.msgs = msgs;
  c.atualizado = timestamp;
  memoria[tel] = c;
  salvarMemoria();
}

// ---------------------------------------------------------------- cardápio dinâmico do banco
let cardapioBancoCache = null;
let ultimoFetchCardapio = 0;

export async function obterCardapioAtivo() {
  const agora = Date.now();
  if (cardapioBancoCache && (agora - ultimoFetchCardapio < 10000)) {
    return cardapioBancoCache;
  }
  try {
    const res = await fetch(`${process.env.API_BASE_URL || 'http://127.0.0.1:8080/api'}/cardapio/texto`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      if (typeof data.cardapio_texto === 'string') {
        cardapioBancoCache = data.cardapio_texto || 'Nenhum produto disponível no momento. Encaminhe para a equipe.';
        ultimoFetchCardapio = agora;
        return cardapioBancoCache;
      }
    }
  } catch { /* fallback se a API estiver em reload */ }
  return cardapioBancoCache || FICHA;
}

// ---------------------------------------------------------------- datas
const fmtData = (d, o) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, ...o }).format(d);
const isoDia = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
function calendario(dias = 7) {
  const linhas = [];
  for (let i = 0; i < dias; i++) {
    const d = new Date(Date.now() + i * 86400e3);
    linhas.push(`${isoDia(d)} = ${fmtData(d, { weekday: 'long', day: '2-digit', month: '2-digit' })}${i === 0 ? ' (hoje)' : i === 1 ? ' (amanhã)' : ''}`);
  }
  return linhas.join('\n');
}

// ---------------------------------------------------------------- prompt de sistema dinâmico
function promptDeSistema(tel, cardapioTexto = null) {
  const estado = tel ? obterEstadoCliente(tel) : null;
  const statusAtual = estado?.status || STATUS_CONVERSA.INICIADA;
  const rascunho = estado?.rascunho || {};
  const rascunhoStr = JSON.stringify(rascunho);
  const cardapioOficial = cardapioTexto ?? cardapioBancoCache ?? FICHA;

  return `Você é o atendente virtual do Restaurante Família Ricardo no WhatsApp.
Seu objetivo é guiar o cliente de forma cordial, ágil e organizada para realizar pedidos de delivery ou consultar o status de um pedido.

[ESTADO CONVERSACIONAL DO CLIENTE]:
- STATUS ATUAL: "${statusAtual}"
- ITENS REGISTRADOS NO RASCUNHO: ${rascunhoStr}

REGRAS OBRIGATÓRIAS DE MÁQUINA DE ESTADOS E CONTINUIDADE:
Sempre verifique o STATUS ATUAL do cliente e dê continuidade exata:
1. Se status for 'conversa_iniciada':
   - Quando o cliente mandar saudação ("oi", "olá"), cumprimente educadamente e pergunte: "Você deseja fazer um pedido ou saber o status de um pedido?"
   - Ao optar por fazer um pedido, atualize o status para 'fazendo_pedido_pratos' e apresente as opções do cardápio com preços e tamanhos consultados da tabela abaixo.
2. Se status for 'fazendo_pedido_pratos':
   - O cliente está escolhendo pratos principais/porções e tamanhos (Infantil, Médio, Grande).
   - Confirme o prato e o tamanho escolhido. Pergunte se deseja adicionar mais algum prato ou se pode avançar para as bebidas.
   - Quando os pratos estiverem definidos, use a ferramenta 'atualizar_status_conversa' com status 'fazendo_pedido_bebidas' e apresente a lista de bebidas.
3. Se status for 'fazendo_pedido_bebidas':
   - O cliente já escolheu os pratos e agora deve escolher as bebidas (Refrigerantes, Sucos, Água, Cervejas) ou informar que não deseja bebidas.
   - Assim que as bebidas forem definidas ou dispensadas, use 'atualizar_status_conversa' com status 'coletando_endereco' e solicite o endereço completo de entrega (Rua, Número, Bairro, CEP/Ponto de Referência e Nome).
4. Se status for 'coletando_endereco':
   - O cliente já escolheu pratos e bebidas. Colete os dados de entrega.
   - Ao receber o endereço, use 'atualizar_status_conversa' com status 'coletando_pagamento' e solicite a forma de pagamento (Cartão de Crédito, Débito, Pix ou Dinheiro).
5. Se status for 'coletando_pagamento':
   - O cliente está definindo o pagamento.
   - Se for Dinheiro, pergunte se precisa de troco e para quanto.
     * Troco para valor exato da compra: avise gentilmente que não precisa de troco.
     * Troco para valor menor que a compra: avise que deve ser maior que o total e pergunte a nota.
   - Apresente o resumo final e chame a ferramenta 'fechar_pedido' (o pedido irá para a cozinha e a conversa voltará a 'conversa_iniciada').
6. Se status for 'preparando_na_cozinha' ou 'saiu_para_entrega':
   - O pedido já foi enviado para a cozinha. Se o cliente perguntar o andamento, use 'consultar_status_pedido'. Se quiser fazer um novo pedido, comece um novo fluxo.
7. REGRA DE TEMPO LIMITE (30 MINUTOS):
   - Se o cliente responder DENTRO de 30 minutos, você CONTINUA DE ONDE ELE PAROU de acordo com o status atual.
   - Se passar de 30 minutos sem fechar o pedido, a sessão expira e retorna ao status inicial ('conversa_iniciada').

REGRAS RÍGIDAS:
- NUNCA dê desconto, não altere os preços da tabela e não invente pratos fora do cardápio oficial.
- Respostas dinâmicas, simpáticas, bem formatadas com emojis e quebras de linha para leitura agradável no WhatsApp.

INFORMAÇÕES DO RESTAURANTE:
${INFORMACOES_NEGOCIO}

CARDÁPIO OFICIAL ATIVO (CONSULTADO DIRETAMENTE DA TABELA DE PRODUTOS):
${cardapioOficial}

TABELA DE DATAS (fuso ${FUSO})
${calendario()}
`;
}

// ---------------------------------------------------------------- ferramentas
const FERRAMENTAS = [
  {
    type: 'function',
    function: {
      name: 'atualizar_status_conversa',
      description: 'Atualiza o estágio atual do atendimento e do pedido do cliente para rastreabilidade e continuidade.',
      parameters: {
        type: 'object',
        properties: {
          novoStatus: {
            type: 'string',
            enum: [
              'conversa_iniciada',
              'fazendo_pedido_pratos',
              'fazendo_pedido_bebidas',
              'coletando_endereco',
              'coletando_pagamento',
              'preparando_na_cozinha',
              'saiu_para_entrega',
              'cancelado_apos_30_minutos',
            ],
            description: 'Novo status da conversa',
          },
          pratos: { type: 'array', items: { type: 'string' }, description: 'Pratos já escolhidos (opcional)' },
          bebidas: { type: 'array', items: { type: 'string' }, description: 'Bebidas escolhidas (opcional)' },
          endereco: { type: 'string', description: 'Endereço já informado (opcional)' },
          formaPagamento: { type: 'string', description: 'Forma de pagamento (opcional)' },
        },
        required: ['novoStatus'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fechar_pedido',
      description: 'Salva o pedido finalizado, gera a comanda e envia para a impressora da cozinha. Só execute após o cliente confirmar itens, endereço e forma de pagamento.',
      parameters: {
        type: 'object',
        properties: {
          nome: { type: 'string', description: 'Nome do cliente' },
          itens: {
            type: 'array',
            items: { type: 'string' },
            description: 'Lista descritiva; cada preço é UNITÁRIO, o total é quantidade vezes preço (ex: ["1x Filé de frango à parmegiana (Grande) - R$ 30,00", "1x Coca-Cola 2L - R$ 20,00"])',
          },
          endereco: { type: 'string', description: 'Endereço completo de entrega (Rua, Número, Bairro, CEP/Referência)' },
          formaPagamento: { type: 'string', description: 'Forma de pagamento (Cartão de Crédito, Débito, Pix ou Dinheiro)' },
          trocoPara: { type: 'string', description: 'Valor para troco se pagamento for em dinheiro (opcional)' },
          total: { type: 'string', description: 'Valor total do pedido (ex: R$ 50,00)' },
          observacoes: { type: 'string', description: 'Observações do cliente (opcional)' },
        },
        required: ['nome', 'itens', 'endereco', 'formaPagamento', 'total'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_status_pedido',
      description: 'Consulta a situação atual de um pedido no sistema pelo número do pedido ou telefone.',
      parameters: {
        type: 'object',
        properties: {
          idOuTelefone: { type: 'string', description: 'Número do pedido (ex: PED-...) ou número de telefone do cliente' },
        },
        required: ['idOuTelefone'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'chamar_atendente',
      description: 'Transfere o atendimento para um atendente humano em caso de dúvidas complexas, reclamações ou status não resolvidos.',
      parameters: {
        type: 'object',
        properties: {
          motivo: { type: 'string', description: 'Motivo da transferência' },
          numeroPedido: { type: 'string', description: 'Número do pedido se houver' },
        },
        required: ['motivo'],
      },
    },
  },
];

async function executar(tel, nome, args) {
  if (!args || Array.isArray(args) || typeof args !== 'object') return { erro: 'Argumentos inválidos' };
  if (nome === 'atualizar_status_conversa') {
    for (const campo of ['pratos', 'bebidas']) {
      if (args[campo] !== undefined && (!Array.isArray(args[campo]) || args[campo].some(item => typeof item !== 'string'))) return { erro: `Campo ${campo} inválido` };
    }
    if ([STATUS_CONVERSA.COZINHA, STATUS_CONVERSA.ENTREGA].includes(args.novoStatus)) return { erro: 'O status operacional deve vir de um pedido registrado.' };
    atualizarStatusCliente(tel, args.novoStatus, {
      pratos: args.pratos,
      bebidas: args.bebidas,
      endereco: args.endereco,
      formaPagamento: args.formaPagamento,
    });
    return { ok: true, statusAtual: args.novoStatus };
  }
  if (nome === 'fechar_pedido') {
    const resPedido = await registrarPedido({
      telefone: tel,
      nome: args.nome,
      itens: args.itens,
      endereco: args.endereco,
      formaPagamento: args.formaPagamento,
      trocoPara: args.trocoPara,
      total: args.total,
      observacoes: args.observacoes,
    });

    // Reset do status do cliente de volta para o início, pois o fluxo do pedido terminou com sucesso!
    atualizarStatusCliente(tel, STATUS_CONVERSA.INICIADA, {
      pratos: [],
      bebidas: [],
      endereco: null,
      formaPagamento: null,
      trocoPara: null,
      total: null,
      ultimoPedidoId: resPedido.id,
    });

    return resPedido;
  }
  if (nome === 'consultar_status_pedido') {
    return consultarStatusPedido(args.idOuTelefone || tel, tel);
  }
  if (nome === 'chamar_atendente') {
    sincronizarStatusBanco(tel, obterEstadoCliente(tel).status, obterEstadoCliente(tel).rascunho, { transbordo: true, motivo_transbordo: args.motivo });
    console.log(`🔔 [TRANSFERÊNCIA PARA ATENDENTE HUMANO] Tel: ${tel} | Motivo: ${args.motivo} | Pedido: ${args.numeroPedido || 'Nenhum'}`);
    return { ok: true, mensagem: 'Solicitação de atendimento humano registrada. Contato direto da equipe: (12) 99750-0045.' };
  }
  return { erro: `Ferramenta desconhecida: ${nome}` };
}

// ---------------------------------------------------------------- modelo OpenRouter
export const chaveOk = () => /^sk-or-/.test(process.env.OPENROUTER_API_KEY || '') && !/cole/.test(process.env.OPENROUTER_API_KEY);
async function chamarModelo(messages) {
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://familia-ricardo-whatsapp.local',
      'X-OpenRouter-Title': 'Agente Restaurante Familia Ricardo',
    },
    signal: AbortSignal.timeout(45000),
    body: JSON.stringify({ model: MODELO, messages, tools: FERRAMENTAS, temperature: 0.3, max_tokens: 1500 }),
  });

  const j = await r.json();
  if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${JSON.stringify(j.error ?? j)}`);
  return j.choices[0].message;
}

// ---------------------------------------------------------------- responder
export async function responder(tel, texto) {
  obterEstadoCliente(tel); // valida inatividade e carrega estado
  const cardapioTexto = await obterCardapioAtivo();
  const messages = [{ role: 'system', content: promptDeSistema(tel, cardapioTexto) }, ...historico(tel), { role: 'user', content: texto }];
  const passos = [];
  let resposta = 'Olá! Tive uma breve instabilidade para consultar as opções. Se precisar de ajuda, ligue para (12) 99750-0045. 🍽️';

  try {
    let pedidoFechado = null;
    for (let i = 0; i < 6; i++) {
      const msg = await chamarModelo(messages);
      if (!msg.tool_calls?.length) {
        resposta = (msg.content || '').trim() || resposta;
        break;
      }
      messages.push({ role: 'assistant', content: msg.content ?? '', tool_calls: msg.tool_calls });
      for (const tc of msg.tool_calls) {
        let args = {};
        try { args = JSON.parse(tc.function.arguments || '{}'); } catch { /* argumento quebrado */ }
        let saida;
        try {
          saida = tc.function.name === 'fechar_pedido' && pedidoFechado
            ? pedidoFechado : await executar(tel, tc.function.name, args);
          if (tc.function.name === 'fechar_pedido' && saida.ok) pedidoFechado = saida;
        } catch (e) { saida = { erro: String(e.message || e) }; }
        passos.push({ ferramenta: tc.function.name, args, saida });
        messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(saida) });
      }
      if (pedidoFechado) break;
    }

    // Se houve fechamento de pedido ou consulta de status, envia a mensagem consultada e gerada diretamente da tabela de pedidos (sem deixar na mão da IA)
    const passoFechar = passos.find((p) => p.ferramenta === 'fechar_pedido' && p.saida?.mensagemCliente);
    if (passoFechar) {
      resposta = passoFechar.saida.mensagemCliente;
      // Garante que o status do cliente fique no início com rascunho limpo após fechar o pedido
      const c = obterEstadoCliente(tel);
      c.status = STATUS_CONVERSA.INICIADA;
      c.rascunho = { pratos: [], bebidas: [], endereco: null, formaPagamento: null, trocoPara: null, total: null, ultimoPedidoId: passoFechar.saida.id };
      salvarMemoria();
      sincronizarStatusBanco(tel, STATUS_CONVERSA.INICIADA, c.rascunho);
    } else {
      const passoStatus = passos.find((p) => p.ferramenta === 'consultar_status_pedido' && p.saida?.mensagemStatus);
      if (passoStatus) {
        resposta = passoStatus.saida.mensagemStatus;
      }
    }
  } catch (err) {
    const errStr = String(err?.message || err);
    console.error(`⚠ [AVISO DE SERVIÇO - Tel: ${tel}]:`, errStr);

    if (/402|budget_exhausted|credits|payment/i.test(errStr)) {
      resposta = 'Olá! No momento nosso canal de atendimento automático está com alta demanda. ⏳\n\nVocê pode falar com nossa equipe pelo telefone. Se preferir fazer seu pedido agora por ligação, ligue para (12) 99750-0045 ou (12) 98146-4976. 🍽️😊';
    } else if (/429|rate_limit|too many requests/i.test(errStr)) {
      resposta = 'Estou recebendo muitas mensagens simultâneas neste momento! ⏳ Já estou processando seu atendimento. Pode aguardar um instante ou falar conosco pelo telefone (12) 99750-0045.';
    } else {
      resposta = 'Desculpe, tive uma instabilidade momentânea na conexão. Você pode falar diretamente com nossa equipe. Contato direto: (12) 99750-0045.';
    }
  }

  // Se o cliente manifestou intenção clara de pedir e estava no início (e não acabou de finalizar um pedido nesta mensagem)
  const passoFecharNestaMensagem = passos.find((p) => p.ferramenta === 'fechar_pedido');
  if (!passoFecharNestaMensagem) {
    const estado = obterEstadoCliente(tel);
    if (estado.status === STATUS_CONVERSA.INICIADA && /(?:quero|vou|gostaria de)\s+(?:fazer\s+um\s+pedido|pedir|comprar)|fazer um pedido/i.test(texto) && !/status|andamento|situa[çc][aã]o/i.test(texto)) {
      estado.status = STATUS_CONVERSA.PRATOS;
      atualizarStatusCliente(tel, STATUS_CONVERSA.PRATOS, estado.rascunho);
    }
  }

  lembrar(tel, 'user', texto);
  lembrar(tel, 'assistant', resposta);
  sincronizarStatusBanco(tel, memoria[tel]?.status, memoria[tel]?.rascunho, { registrar_mensagem: true });
  appendFileSync(process.env.ARQ_LOG || fileURLToPath(new URL('./conversas.log', import.meta.url)), JSON.stringify({ quando: new Date().toISOString(), tel, status: memoria[tel]?.status, texto, passos, resposta }) + '\n');
  return resposta;
}

// ---------------------------------------------------------------- fila por telefone
const enfileirarResposta = criarFilaPorChave();
export function responderNaFila(tel, texto) {
  return enfileirarResposta(tel, () => responder(tel, texto));
}
