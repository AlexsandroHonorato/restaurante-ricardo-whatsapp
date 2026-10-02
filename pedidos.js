// pedidos.js: Gerenciamento, persistência e formatação de comandas de pedidos
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const ARQ_PEDIDOS = 'pedidos.json';

function carregarPedidos() {
  if (!existsSync(ARQ_PEDIDOS)) return {};
  try {
    return JSON.parse(readFileSync(ARQ_PEDIDOS, 'utf8'));
  } catch {
    return {};
  }
}

function salvarPedidos(pedidos) {
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
  } catch { /* não bloqueia a resposta ao cliente se a API estiver em boot */ }

  const comanda = formatarComanda(pedido);
  imprimirComanda(comanda);

  return { ok: true, id: novoId, status: pedido.status, tempoEstimado: '40 a 60 minutos', comanda };
}

export function consultarStatusPedido(idOuTelefone) {
  const pedidos = carregarPedidos();
  if (!idOuTelefone) return { erro: 'Informe o número do pedido ou seu telefone.' };

  const idLimpo = String(idOuTelefone).trim();
  if (pedidos[idLimpo]) {
    const p = pedidos[idLimpo];
    return { ok: true, id: p.id, status: p.status, itens: p.itens, dataHora: p.dataHora, nome: p.nome };
  }

  // Busca pelo telefone
  const telLimpo = idLimpo.replace(/\D/g, '');
  const encontrados = Object.values(pedidos).filter((p) => p.telefone && p.telefone.replace(/\D/g, '').includes(telLimpo));
  if (encontrados.length > 0) {
    const p = encontrados.at(-1); // último pedido
    return { ok: true, id: p.id, status: p.status, itens: p.itens, dataHora: p.dataHora, nome: p.nome };
  }

  return { aviso: 'Pedido não localizado automaticamente. Encaminhando para o atendente.' };
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
