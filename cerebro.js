import { apiBot, cabecalhosApiBot } from './lib/api-bot.js';
// cerebro.js: memória + ficha do negócio + modelo (OpenRouter) + máquina de estados + ferramentas de pedidos.
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { criarLogConversas } from './lib/log-conversas.js';
import { criarFilaPorChave } from './lib/fila.js';
import { criarLimitador } from './lib/limite-mensagens.js';
import { EMPRESA, definirFicha } from './lib/empresa.js';
import { perfilNegocio } from './lib/perfil-negocio.js';
import { consultarAtendimento } from './lib/horario-atendimento.js';
import { registrarPedido, consultarStatusPedido, calcularTotalPedido, nomeSituacaoPedido } from './pedidos.js';

const FUSO = process.env.FUSO || 'America/Sao_Paulo';
const MODELO = process.env.MODELO || 'google/gemini-3.7-flash';
const MAX_MENSAGENS = 20;              // quantas mensagens da conversa voltam para o modelo
const EXPIRA_MINUTOS_INATIVIDADE = 30;   // inatividade de 30 min antes de fechar o pedido expira e volta ao início
const registrarConversa = criarLogConversas(
  process.env.ARQ_LOG || fileURLToPath(new URL('./conversas.log', import.meta.url)),
  { retencaoDias: Number(process.env.LOG_RETENCAO_DIAS) || 30 },
);
const FICHA = readFileSync(process.env.ARQ_NEGOCIO || new URL('./negocio.md', import.meta.url), 'utf8');
const INFORMACOES_NEGOCIO = FICHA.split(/(?=^## )/m)
  .filter(secao => /^## (Quem somos|Horários|Endereço|Formas|Políticas)/m.test(secao)).join('\n');

// ---------------------------------------------------------------- status conversacionais
export const STATUS_CONVERSA = {
  INICIADA: 'conversa_iniciada',
  TRANSBORDO: 'transbordo_humano',
  PRATOS: 'fazendo_pedido_pratos',
  BEBIDAS: 'fazendo_pedido_bebidas',
  ENDERECO: 'coletando_endereco',
  PAGAMENTO: 'coletando_pagamento',
  COZINHA: 'preparando_na_cozinha',
  ENTREGA: 'saiu_para_entrega',
  CANCELADO_30MIN: 'cancelado_apos_30_minutos',
};

// ---------------------------------------------------------------- memória com máquina de estados
// Cache em memória da conversa. A fonte da verdade é o MySQL (status_conversas + mensagens_whatsapp):
// após reiniciar, carregarConversa() busca etapa, rascunho, histórico e último pedido pela API.
export const memoria = {};

export async function carregarConversa(tel) {
  // Cache vale enquanto a conversa está ativa; parada por 30 min, recarrega do banco
  // (reflete dados apagados pela equipe — LGPD — e conversas atendidas pelo painel).
  if (memoria[tel] && Date.now() - memoria[tel].atualizado < EXPIRA_MINUTOS_INATIVIDADE * 60 * 1000) return memoria[tel];
  const dados = await apiBot.conversa(tel);
  memoria[tel] = {
    status: dados.status || STATUS_CONVERSA.INICIADA,
    rascunho: dados.rascunho || { pratos: [], bebidas: [], endereco: null, formaPagamento: null, trocoPara: null, total: null },
    atualizado: dados.ultimo_contato_em ? Date.parse(dados.ultimo_contato_em) : Date.now(),
    msgs: Array.isArray(dados.historico) ? dados.historico.slice(-MAX_MENSAGENS) : [],
    ultimoPedido: dados.ultimo_pedido || null,
    // Sem nenhum registro no banco: primeiro contato, recebe o aviso de privacidade (LGPD).
    primeiroContato: !dados.status && !(Array.isArray(dados.historico) && dados.historico.length),
  };
  return memoria[tel];
}

const limitador = criarLimitador({
  porMinuto: Number(process.env.LIMITE_MENSAGENS_MINUTO) || 8,
  porHora: Number(process.env.LIMITE_MENSAGENS_HORA) || 60,
});

// Ficha da empresa: editada no painel (Configurações → Dados da empresa); vazia = arquivo negocio.md.
let informacoesNegocio = INFORMACOES_NEGOCIO;
async function atualizarFicha() {
  try {
    const dados = await apiBot.empresa();
    definirFicha(dados);
    informacoesNegocio = dados?.texto || INFORMACOES_NEGOCIO;
  } catch (erro) {
    // Mantém a última ficha conhecida.
    console.warn(JSON.stringify({ evento: 'ficha_empresa_indisponivel', erro: erro.message }));
  }
}

const AVISO_PRIVACIDADE = () => `🔒 Aviso de privacidade: usamos seu nome, telefone e endereço apenas para atender e entregar seus pedidos do *${EMPRESA.nome}*. Se quiser que seus dados sejam apagados, é só pedir para falar com a equipe.`;

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
    // O banco é a fonte da verdade da conversa: tenta 3 vezes antes de desistir.
    for (const espera of [0, 1000, 3000]) {
      await new Promise(resolve => setTimeout(resolve, espera));
      try {
        const resposta = await fetch(`${process.env.API_BASE_URL || 'http://127.0.0.1:8080/api'}/status-conversa/sync`, {
          signal: AbortSignal.timeout(5000), method: 'POST',
          headers: { ...cabecalhosApiBot(), 'Content-Type': 'application/json' }, body: corpo,
        });
        if (!resposta.ok) throw new Error(`API de status retornou ${resposta.status}`);
        return;
      } catch (erro) { console.warn('Falha ao sincronizar conversa:', tel, erro.message); }
    }
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
  sincronizarStatusBanco(tel, novoStatus, c.rascunho, extras);
  return c;
}

/** Pedido das últimas 12 horas que ainda não foi entregue nem cancelado. */
function pedidoEmAberto(pedido) {
  return !!pedido && !['entregue', 'cancelado'].includes(pedido.status)
    && Date.now() - new Date(pedido.created_at).getTime() < 12 * 60 * 60 * 1000;
}

export function historico(tel) {
  const c = obterEstadoCliente(tel);
  return c.msgs || [];
}

export function limparMemoria(tel) {
  delete memoria[tel];
}

export function lembrar(tel, role, content, timestamp = Date.now()) {
  const c = obterEstadoCliente(tel);
  const msgs = [...(c.msgs || []), { role, content }].slice(-MAX_MENSAGENS);
  c.msgs = msgs;
  c.atualizado = timestamp;
  memoria[tel] = c;
}

// ---------------------------------------------------------------- cardápio dinâmico do banco
let cardapioBancoCache = null;
let ultimoFetchCardapio = 0;
const CARDAPIO_INDISPONIVEL = 'Cardápio temporariamente indisponível no sistema. NÃO ofereça itens nem preços e NÃO feche pedidos: peça ao cliente para tentar novamente em alguns minutos ou ligar para a loja.';

export async function obterCardapioAtivo() {
  const agora = Date.now();
  if (cardapioBancoCache && (agora - ultimoFetchCardapio < 10000)) {
    return cardapioBancoCache;
  }
  try {
    const res = await fetch(`${process.env.API_BASE_URL || 'http://127.0.0.1:8080/api'}/cardapio/texto`, { headers: cabecalhosApiBot(), signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      if (typeof data.cardapio_texto === 'string') {
        cardapioBancoCache = data.cardapio_texto || 'Nenhum produto disponível no momento. Encaminhe para a equipe.';
        ultimoFetchCardapio = agora;
        return cardapioBancoCache;
      }
    }
  } catch { /* fallback se a API estiver em reload */ }
  // Sem cardápio do banco não há códigos [cod N] nem preços confiáveis: a IA não deve oferecer itens.
  return cardapioBancoCache || CARDAPIO_INDISPONIVEL;
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
/** Etapas numeradas do atendimento conforme o perfil do negócio (restaurante tem a etapa de bebidas). */
function etapasDoPerfil(perfil) {
  const etapas = [
    `Se status for 'conversa_iniciada':
   - Quando o cliente enviar uma saudação inicial ("oi", "olá", "boa tarde", "bom dia", etc.):
     * SE o cliente tiver um PEDIDO RECENTE/ATIVO:
       Cumprimente educadamente pelo nome (se disponível), informe que localizou o pedido recente em andamento e apresente o menu numerado claro (troque [nome] e [código] pelos dados do PEDIDO RECENTE/ATIVO no ESTADO DO CLIENTE; sem nome, escreva só "Olá!"):
       "Olá, [nome]! Tudo bem? 😊${perfil.emoji}\nSeja bem-vindo(a) de volta ao *${EMPRESA.nome}*!\nIdentifiquei seu pedido recente *[código]* em andamento.\n\nComo posso te ajudar agora?\n1️⃣ *Fazer um novo pedido*\n2️⃣ *Acompanhar meu pedido*\n3️⃣ *Falar com a equipe*\n\nPor favor, digite o número da opção ou o que deseja!"

     * SE NÃO houver pedido recente ativo:
       Apresente a saudação calorosa com o menu numerado claro:
       "Olá! Tudo bem? 😊${perfil.emoji}\nSeja muito bem-vindo(a) ao *${EMPRESA.nome}*!\n\nComo posso te ajudar hoje?\n1️⃣ *Fazer um pedido*\n2️⃣ *Consultar status de um pedido*\n3️⃣ *Falar com a equipe*\n\nPor favor, digite o número da opção ou o que deseja!"

   - Se o cliente responder "1", "1️⃣", "fazer pedido", "quero pedir", "pedido", "${perfil.catalogo}", "fazer um novo pedido":
     Atualize o status para 'fazendo_pedido_pratos' e ${perfil.apresentarCatalogo}
   - Se o cliente responder "2", "2️⃣", "status", "acompanhar", "meu pedido", "rastrear", "consultar status":
     Execute a ferramenta 'consultar_status_pedido' imediatamente.
   - Se o cliente responder "3", "3️⃣", "falar com a equipe", "humano", "atendente", "falar com atendente":
     Execute a ferramenta 'chamar_atendente'.
`,
    perfil.etapaItens,
    perfil.etapaBebidas,
    `Se status for 'coletando_endereco':
   - ${perfil.jaEscolheu} Colete os dados de entrega.
   - Ao receber o endereço, chame 'calcular_total_pedido' com TODOS os itens escolhidos (código + quantidade) e use 'atualizar_status_conversa' com status 'coletando_pagamento'.
   - Na mesma resposta, mostre o resumo dos itens e o *valor total* devolvido pela ferramenta e só então pergunte a forma de pagamento (Cartão de Crédito, Débito, Pix ou Dinheiro): o cliente decide como pagar sabendo quanto vai pagar.`,
    `Se status for 'coletando_pagamento':
   - O cliente está definindo o pagamento e precisa saber o valor total: se o TOTAL JÁ INFORMADO no ESTADO DO CLIENTE estiver vazio ou os itens mudaram, chame 'calcular_total_pedido' e informe o total antes de aceitar a forma de pagamento.
   - Se for Dinheiro, pergunte se precisa de troco e para quanto.
     * Troco para valor exato da compra: avise gentilmente que não precisa de troco.
     * Troco para valor menor que a compra: avise que deve ser maior que o total e pergunte a nota.
   - Apresente o resumo final e chame a ferramenta 'fechar_pedido' (o pedido irá para ${perfil.destino} e a conversa voltará a 'conversa_iniciada').`,
    `Se status for 'preparando_na_cozinha' ou 'saiu_para_entrega':
   - O pedido já foi enviado para ${perfil.destino}. Se o cliente perguntar o andamento, use 'consultar_status_pedido'. Se quiser fazer um novo pedido, comece um novo fluxo.`,
    `REGRA DE TEMPO LIMITE (30 MINUTOS):
   - Se o cliente responder DENTRO de 30 minutos, você CONTINUA DE ONDE ELE PAROU de acordo com o status atual.
   - Se passar de 30 minutos sem fechar o pedido, a sessão expira e retorna ao status inicial ('conversa_iniciada').`,
  ].filter(Boolean);
  return etapas.map((etapa, i) => `${i + 1}. ${etapa}`).join('\n');
}

/**
 * Duas partes: a primeira é igual para todos os clientes (instruções, ficha e cardápio) e fica em cache
 * no provedor (prefixo repetido sai bem mais barato); a segunda muda a cada mensagem e vai por último.
 */
function promptDeSistema(tel, cardapioTexto = null) {
  const estado = tel ? obterEstadoCliente(tel) : null;
  const statusAtual = estado?.status || STATUS_CONVERSA.INICIADA;
  const rascunho = estado?.rascunho || {};
  const rascunhoStr = JSON.stringify(rascunho);
  const cardapioOficial = cardapioTexto ?? cardapioBancoCache ?? CARDAPIO_INDISPONIVEL;
  // Último pedido vem do banco (carregarConversa) e é atualizado ao fechar um pedido nesta conversa.
  const ultimo = estado?.ultimoPedido;
  const ultimoPedido = ultimo ? { id: ultimo.codigo_pedido, status: ultimo.status, nome: ultimo.nome, dataHora: ultimo.created_at } : null;
  // Entregue ou cancelado não é mais "em andamento": a saudação volta ao menu comum.
  const temPedidoAtivo = pedidoEmAberto(ultimo);
  const perfil = perfilNegocio(EMPRESA.tipo);

  const fixo = `Você é o atendente virtual do ${EMPRESA.nome} no WhatsApp.
Seu objetivo é guiar o cliente de forma cordial, ágil e organizada para realizar pedidos de delivery ou consultar o status de um pedido.

REGRAS OBRIGATÓRIAS DE MÁQUINA DE ESTADOS E SAUDAÇÃO:
Sempre verifique o STATUS ATUAL do cliente (no ESTADO DO CLIENTE, ao final) e dê continuidade exata:
${etapasDoPerfil(perfil)}

REGRA DE MENSAGEM FORA DO CONTEXTO:
- Se o cliente escrever algo que não tem relação com ${perfil.estabelecimento} nem com a etapa atual do atendimento (assuntos aleatórios, piadas, política, futebol, pedidos de tarefas, texto sem sentido), NÃO responda ao assunto, NÃO chame ferramentas e NÃO mude o status. Responda exatamente:
  "Desculpe, não entendi. 😅 Por favor, escolha uma das opções acima."
- Se ainda não houver opções apresentadas nesta conversa, responda "Desculpe, não entendi. 😅" e apresente o menu numerado inicial.
- NÃO trate como fora do contexto: saudações, respostas que a etapa atual pediu (nome, endereço, ponto de referência, forma de pagamento, troco, "sim", "não", quantidades, números de opção) e dúvidas sobre ${perfil.estabelecimento} (${perfil.catalogo}, preços, horários, endereço, entrega, pagamento).

REGRAS RÍGIDAS:
- NUNCA dê desconto, não altere os preços da tabela e não invente ${perfil.itens} fora do ${perfil.catalogo} oficial.
- Cada tamanho do ${perfil.catalogo} tem um código "[cod N]". Use-o em 'fechar_pedido' (codigo + quantidade). Nunca mostre esses códigos ao cliente.
- Valores saem do sistema: para informar o total use sempre 'calcular_total_pedido' (nunca some os preços você mesmo); o valor final é conferido de novo ao fechar o pedido e o comprovante enviado ao cliente sai do sistema.
- Nunca mostre ao cliente códigos internos do sistema (palavras com sublinhado, como "em_preparo" ou "coletando_pagamento"): escreva sempre em português comum, por exemplo "Em preparação" ou "Saiu para entrega".
- Respostas dinâmicas, simpáticas, bem formatadas com emojis e quebras de linha para leitura agradável no WhatsApp.

INFORMAÇÕES ${perfil.artigo} ${perfil.rotulo}:
${informacoesNegocio}

${perfil.catalogo.toUpperCase()} OFICIAL ATIVO (CONSULTADO DIRETAMENTE DA TABELA DE PRODUTOS):
${cardapioOficial}
`;

  const variavel = `
TABELA DE DATAS (fuso ${FUSO})
${calendario()}

[ESTADO DO CLIENTE]:
- STATUS ATUAL: "${statusAtual}"
- ITENS REGISTRADOS NO RASCUNHO: ${rascunhoStr}
- TOTAL JÁ INFORMADO AO CLIENTE: ${rascunho.total || 'ainda não calculado'}
- PEDIDO RECENTE/ATIVO IDENTIFICADO: ${temPedidoAtivo ? `${ultimoPedido.id} (Status atual: "${nomeSituacaoPedido(ultimoPedido.status)}", Cliente: "${ultimoPedido.nome || 'Cliente'}")` : 'Nenhum pedido ativo recente'}
`;

  return [
    { type: 'text', text: fixo, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: variavel },
  ];
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
      description: 'Salva o pedido finalizado, gera a comanda e envia para a cozinha. Só execute após o cliente confirmar itens, endereço e forma de pagamento. O sistema calcula preços e total a partir dos códigos; se recusar (item indisponível, fora do dia, mínimo, troco), explique o motivo ao cliente.',
      parameters: {
        type: 'object',
        properties: {
          nome: { type: 'string', description: 'Nome do cliente' },
          itens: {
            type: 'array',
            description: 'Cada item escolhido: o código [cod N] do TAMANHO no cardápio oficial e a quantidade.',
            items: {
              type: 'object',
              properties: {
                codigo: { type: 'integer', description: 'Número do [cod N] do tamanho escolhido (ex: 13)' },
                quantidade: { type: 'integer', description: 'Quantidade desse item (1 a 100)' },
              },
              required: ['codigo', 'quantidade'],
            },
          },
          endereco: { type: 'string', description: 'Endereço completo de entrega (Rua, Número, Bairro, CEP/Referência) ou "Retirada no balcão"' },
          formaPagamento: { type: 'string', description: 'Forma de pagamento (Cartão de Crédito, Débito, Pix ou Dinheiro)' },
          trocoPara: { type: 'string', description: 'Valor para troco se pagamento for em dinheiro (opcional)' },
          observacoes: { type: 'string', description: 'Observações do cliente (opcional)' },
        },
        required: ['nome', 'itens', 'endereco', 'formaPagamento'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calcular_total_pedido',
      description: 'Calcula o valor total do pedido em montagem com os preços do sistema, sem fechar o pedido. Use antes de perguntar a forma de pagamento, para informar o total ao cliente. Se recusar (item indisponível ou fora do dia), explique o motivo ao cliente.',
      parameters: {
        type: 'object',
        properties: {
          itens: {
            type: 'array',
            description: 'Todos os itens escolhidos: o código [cod N] do TAMANHO no cardápio oficial e a quantidade.',
            items: {
              type: 'object',
              properties: {
                codigo: { type: 'integer', description: 'Número do [cod N] do tamanho escolhido (ex: 13)' },
                quantidade: { type: 'integer', description: 'Quantidade desse item (1 a 100)' },
              },
              required: ['codigo', 'quantidade'],
            },
          },
        },
        required: ['itens'],
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

async function executar(tel, nome, args, contexto = {}) {
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
      observacoes: args.observacoes,
      // Uma mensagem do cliente gera no máximo um pedido, mesmo se for reprocessada.
      chave: contexto.chave ? `pedido:${contexto.chave}` : undefined,
    });
    memoria[tel].ultimoPedido = { codigo_pedido: resPedido.id, status: 'em_preparo', created_at: new Date().toISOString(), nome: args.nome };

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
  if (nome === 'calcular_total_pedido') {
    const calculo = await calcularTotalPedido(args.itens);
    // Fica no rascunho: aparece no ESTADO DO CLIENTE das próximas mensagens e no monitor do painel.
    obterEstadoCliente(tel).rascunho.total = calculo.total;
    return calculo;
  }
  if (nome === 'consultar_status_pedido') {
    return consultarStatusPedido(args.idOuTelefone || tel, tel);
  }
  if (nome === 'chamar_atendente') {
    atualizarStatusCliente(tel, STATUS_CONVERSA.TRANSBORDO, {}, { transbordo: true, motivo_transbordo: args.motivo });
    console.log(`🔔 [TRANSFERÊNCIA PARA ATENDENTE HUMANO] Tel: ${tel} | Motivo: ${args.motivo} | Pedido: ${args.numeroPedido || 'Nenhum'}`);
    return { ok: true, mensagem: `Solicitação de atendimento humano registrada. Contato direto da equipe: ${EMPRESA.telefone}.` };
  }
  return { erro: `Ferramenta desconhecida: ${nome}` };
}

// ---------------------------------------------------------------- modelo OpenRouter
export const chaveOk = () => /^sk-or-/.test(process.env.OPENROUTER_API_KEY || '') && !/cole/.test(process.env.OPENROUTER_API_KEY);
async function chamarModelo(messages) {
  // OPENROUTER_URL só é trocado no teste ponta a ponta (tests/e2e), que simula o modelo localmente.
  const r = await fetch(process.env.OPENROUTER_URL || 'https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://familia-ricardo-whatsapp.local',
      'X-OpenRouter-Title': `Agente ${EMPRESA.nome}`.normalize('NFD').replace(/[̀-ͯ]/g, ''), // cabeçalho HTTP só aceita ASCII com segurança
    },
    signal: AbortSignal.timeout(45000),
    body: JSON.stringify({ model: MODELO, messages, tools: FERRAMENTAS, temperature: 0.3, max_tokens: 1500 }),
  });

  const j = await r.json();
  if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${JSON.stringify(j.error ?? j)}`);
  return j.choices[0].message;
}

// ---------------------------------------------------------------- responder
/** contexto.chave: id da mensagem na Meta (idempotência do pedido). Lança erro se o banco não responder. */
export async function responder(tel, texto, contexto = {}) {
  const atendimento = await consultarAtendimento();
  if (!atendimento.aberto) return atendimento.mensagem;
  // A equipe assumiu a conversa pelo painel: a mensagem fica registrada e o bot não responde.
  const emTransbordo = memoria[tel]?.status === STATUS_CONVERSA.TRANSBORDO;
  // Espera o transbordo chegar ao banco antes de comparar com a etapa gravada.
  if (emTransbordo) await filasSincronizacao.get(tel);
  const pausa = await apiBot.pausa(tel);
  if (pausa.pausado === true) return null;
  // A equipe encerrou o transbordo pelo painel (excluiu o alerta ou a conversa): recomeça do estado do banco.
  if (emTransbordo && pausa.status !== undefined && pausa.status !== STATUS_CONVERSA.TRANSBORDO) delete memoria[tel];
  // Protege os créditos da IA: acima do limite avisa uma vez e depois não responde (null).
  const limite = limitador.verificar(tel);
  if (limite === 'silencio') return null;
  if (limite === 'avisar') return `Recebi muitas mensagens seguidas 😅 Aguarde um minutinho e me mande de novo, por favor. Se for urgente, ligue para ${EMPRESA.telefone}.`;
  await carregarConversa(tel);
  // A cozinha muda o status pelo painel: com pedido em aberto, confere a situação atual no banco.
  if (pedidoEmAberto(memoria[tel].ultimoPedido)) {
    try {
      memoria[tel].ultimoPedido = (await apiBot.conversa(tel)).ultimo_pedido || memoria[tel].ultimoPedido;
    } catch (erro) {
      console.warn(JSON.stringify({ evento: 'status_do_pedido_indisponivel', erro: erro.message }));
    }
  }
  await atualizarFicha();
  obterEstadoCliente(tel); // valida inatividade
  const cardapioTexto = await obterCardapioAtivo();
  const messages = [{ role: 'system', content: promptDeSistema(tel, cardapioTexto) }, ...historico(tel), { role: 'user', content: texto }];
  const passos = [];
  let resposta = `Olá! Tive uma breve instabilidade para consultar as opções. Se precisar de ajuda, ligue para ${EMPRESA.telefone}. 🍽️`;

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
            ? pedidoFechado : await executar(tel, tc.function.name, args, contexto);
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
      sincronizarStatusBanco(tel, STATUS_CONVERSA.INICIADA, c.rascunho);
    } else {
      const passoStatus = passos.find((p) => p.ferramenta === 'consultar_status_pedido' && p.saida?.mensagemStatus);
      if (passoStatus) {
        resposta = passoStatus.saida.mensagemStatus;
      }
      // Total calculado nesta mensagem: o cliente precisa vê-lo antes de escolher o pagamento, mesmo se a IA não citar.
      const total = passos.findLast((p) => p.ferramenta === 'calcular_total_pedido' && p.saida?.ok)?.saida.total;
      if (total && !passoStatus && !resposta.includes(total.replace('R$ ', ''))) {
        resposta += `\n\n💰 *Total do pedido:* ${total}`;
      }
    }
  } catch (err) {
    const errStr = String(err?.message || err);
    console.error(`⚠ [AVISO DE SERVIÇO - Tel: ${tel}]:`, errStr);

    if (/402|budget_exhausted|credits|payment/i.test(errStr)) {
      resposta = `Olá! No momento nosso canal de atendimento automático está com alta demanda. ⏳\n\nVocê pode falar com nossa equipe pelo telefone. Se preferir fazer seu pedido agora por ligação, ligue para ${[EMPRESA.telefone, EMPRESA.telefoneAlternativo].filter(Boolean).join(' ou ')}. 🍽️😊`;
    } else if (/429|rate_limit|too many requests/i.test(errStr)) {
      resposta = `Estou recebendo muitas mensagens simultâneas neste momento! ⏳ Já estou processando seu atendimento. Pode aguardar um instante ou falar conosco pelo telefone ${EMPRESA.telefone}.`;
    } else {
      resposta = `Desculpe, tive uma instabilidade momentânea na conexão. Você pode falar diretamente com nossa equipe. Contato direto: ${EMPRESA.telefone}.`;
    }
  }

  // Se o cliente manifestou intenção clara de pedir e estava no início (e não acabou de finalizar um pedido nesta mensagem)
  const passoFecharNestaMensagem = passos.find((p) => p.ferramenta === 'fechar_pedido');
  if (!passoFecharNestaMensagem) {
    const estado = obterEstadoCliente(tel);
    if (estado.status === STATUS_CONVERSA.INICIADA && /(?:quero|vou|gostaria de)\s+(?:fazer\s+um\s+pedido|pedir|comprar)|fazer um pedido|^1$|^1\b|^op[çc][aã]o 1|card[aá]pio/i.test(texto) && !/status|andamento|situa[çc][aã]o/i.test(texto)) {
      estado.status = STATUS_CONVERSA.PRATOS;
      atualizarStatusCliente(tel, STATUS_CONVERSA.PRATOS, estado.rascunho);
    }
  }

  if (memoria[tel]?.primeiroContato) {
    memoria[tel].primeiroContato = false;
    resposta = `${AVISO_PRIVACIDADE()}\n\n${resposta}`;
  }
  lembrar(tel, 'user', texto);
  lembrar(tel, 'assistant', resposta);
  sincronizarStatusBanco(tel, memoria[tel]?.status, memoria[tel]?.rascunho, { registrar_mensagem: true });
  registrarConversa({ quando: new Date().toISOString(), tel, status: memoria[tel]?.status, texto, passos, resposta });
  return resposta;
}

// ---------------------------------------------------------------- fila por telefone
const enfileirarResposta = criarFilaPorChave();
export function responderNaFila(tel, texto, contexto = {}) {
  return enfileirarResposta(tel, () => responder(tel, texto, contexto));
}
