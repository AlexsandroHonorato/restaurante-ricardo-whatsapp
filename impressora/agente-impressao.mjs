// Agente de impressão da cozinha: busca na API os pedidos fechados que ainda não têm comanda e imprime
// na térmica pela rede (ESC/POS, porta 9100). Feito para a Bematech MP-4200 TH em modo ESC/POS, página PC850.
// Rode no computador da cozinha:  node --env-file=impressora/.env impressora/agente-impressao.mjs
// Página de teste:               node --env-file=impressora/.env impressora/agente-impressao.mjs --teste
// Passo a passo de instalação em docs/IMPRESSORA.md.
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const ESC = 0x1b;
const GS = 0x1d;

// ---------------------------------------------------------------- texto da comanda
const reais = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/ /g, ' ');

/** Comanda em texto puro; `colunas` = caracteres por linha (48 na bobina de 80 mm, fonte normal). */
export function formatarComanda(p, colunas = 48) {
  const separador = '-'.repeat(colunas);
  // Texto à esquerda e valor à direita; se não couber, o valor desce para a linha de baixo.
  const linha = (esquerda, direita) =>
    esquerda.length + direita.length + 1 <= colunas
      ? esquerda + direita.padStart(colunas - esquerda.length)
      : `${esquerda}\n${direita.padStart(colunas)}`;
  const e = p.endereco;
  const quando = new Date(p.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
  const itens = (p.itens || []).flatMap((i) => [
    linha(`${i.quantidade}x ${i.nome_snapshot} (${i.tamanho_snapshot})`, reais(i.subtotal)),
    ...(i.adicionais || []).map((a) => `   + ${a.quantidade}x ${a.nome_snapshot}`),
    ...(i.observacao ? [`   obs: ${i.observacao}`] : []),
  ]);
  return [
    `COMANDA ${p.codigo_pedido}`,
    quando,
    separador,
    `Cliente: ${p.cliente?.nome || 'Cliente WhatsApp'}`,
    `Tel: ${p.cliente?.telefone || '-'}`,
    e ? `Entrega: ${e.logradouro}, ${e.numero} - ${e.bairro}` : 'Retirada no balcão',
    ...(e?.complemento ? [`Compl.: ${e.complemento}`] : []),
    ...(e?.ponto_referencia ? [`Ref.: ${e.ponto_referencia}`] : []),
    separador,
    ...itens,
    separador,
    linha('Subtotal', reais(p.valor_subtotal)),
    ...(Number(p.taxa_entrega) ? [linha('Entrega', reais(p.taxa_entrega))] : []),
    ...(Number(p.valor_desconto) ? [linha('Desconto', `-${reais(p.valor_desconto)}`)] : []),
    linha('TOTAL', reais(p.valor_total)),
    `Pagamento: ${String(p.forma_pagamento || '').replace(/_/g, ' ').toUpperCase()}`,
    ...(p.troco_para ? [`Troco para ${reais(p.troco_para)}`] : []),
    ...(p.observacoes ? [separador, `OBS: ${p.observacoes}`] : []),
    separador,
  ].join('\n');
}

// ---------------------------------------------------------------- ESC/POS
// Página de código PC850 (padrão de fábrica da MP-4200 TH em ESC/POS): acentos do português.
const CP850 = {
  'Ç': 0x80, 'ü': 0x81, 'é': 0x82, 'â': 0x83, 'à': 0x85, 'ç': 0x87, 'ê': 0x88, 'É': 0x90, 'ô': 0x93,
  'á': 0xa0, 'í': 0xa1, 'ó': 0xa2, 'ú': 0xa3, 'ª': 0xa6, 'º': 0xa7, 'Á': 0xb5, 'Â': 0xb6, 'À': 0xb7,
  'ã': 0xc6, 'Ã': 0xc7, 'Ê': 0xd2, 'Í': 0xd6, 'Ó': 0xe0, 'Ô': 0xe2, 'õ': 0xe4, 'Õ': 0xe5, 'Ú': 0xe9,
};

/** Converte para bytes PC850; emoji some, outro caractere sem equivalente vira a letra sem acento ou "?". */
export function codificarCp850(texto) {
  const bytes = [];
  for (const c of String(texto).normalize('NFC')) {
    const codigo = c.codePointAt(0);
    if (c === '\n' || (codigo >= 0x20 && codigo < 0x7f)) bytes.push(codigo);
    else if (CP850[c]) bytes.push(CP850[c]);
    else if (/\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{M}|️|‍/u.test(c)) continue;
    else {
      const base = c.normalize('NFD')[0];
      bytes.push(base.codePointAt(0) < 0x7f ? base.codePointAt(0) : 0x3f);
    }
  }
  return bytes;
}

/** Comanda pronta para a impressora: título em destaque, corpo normal, avanço e corte parcial. */
export function montarImpressao(texto) {
  const [titulo, ...corpo] = texto.split('\n');
  return Buffer.from([
    ESC, 0x40, // inicializa
    ESC, 0x74, 0x02, // página de código PC850
    ESC, 0x45, 0x01, GS, 0x21, 0x01, // negrito + altura dupla
    ...codificarCp850(titulo), 0x0a,
    ESC, 0x45, 0x00, GS, 0x21, 0x00, // volta ao normal
    ...codificarCp850(corpo.join('\n')), 0x0a,
    ESC, 0x64, 0x05, // avança 5 linhas (passa da guilhotina)
    GS, 0x56, 0x01, // corte parcial
  ]);
}

/** Envia os bytes pela rede (porta RAW 9100); falha se a impressora não aceitar em `limiteMs`. */
export function enviarParaImpressora(bytes, { ip, porta = 9100, limiteMs = 10000 }) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: ip, port: porta });
    socket.setTimeout(limiteMs, () => socket.destroy(new Error(`impressora ${ip}:${porta} não respondeu`)));
    socket.once('error', reject);
    socket.once('connect', () => socket.end(bytes));
    socket.once('close', (comErro) => { if (!comErro) resolve(); });
  });
}

// ---------------------------------------------------------------- ciclo
/**
 * Um ciclo: lista pendentes, pega cada pedido (só imprime quem pegou primeiro) e imprime.
 * Se a impressora falhar, devolve o pedido e para o ciclo (tenta de novo no próximo).
 */
export function criarAgente({ apiUrl, token, imprimir, colunas = 48, log = (evento) => console.log(JSON.stringify(evento)) }) {
  const api = async (caminho, metodo = 'GET') => {
    const r = await fetch(`${apiUrl.replace(/\/$/, '')}/impressora${caminho}`, {
      method: metodo,
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error(`API respondeu ${r.status} em ${metodo} ${caminho}`);
    return r.json();
  };
  let ocupado = false;
  return async function ciclo() {
    if (ocupado) return;
    ocupado = true;
    try {
      const { pedidos } = await api('/pendentes');
      for (const pedido of pedidos) {
        const { primeira } = await api(`/pedidos/${pedido.id}/comanda`, 'POST');
        if (!primeira) continue; // outro aparelho já imprimiu
        try {
          await imprimir(montarImpressao(formatarComanda(pedido, colunas)));
          log({ evento: 'comanda_impressa', pedido: pedido.codigo_pedido });
        } catch (erro) {
          await api(`/pedidos/${pedido.id}/comanda`, 'DELETE').catch(() => {});
          log({ evento: 'impressora_falhou', pedido: pedido.codigo_pedido, erro: erro.message });
          break;
        }
      }
    } catch (erro) {
      log({ evento: 'api_indisponivel', erro: erro.message });
    } finally {
      ocupado = false;
    }
  };
}

// ---------------------------------------------------------------- execução
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { API_URL, IMPRESSORA_TOKEN, IMPRESSORA_IP } = process.env;
  const porta = Number(process.env.IMPRESSORA_PORTA || 9100);
  const colunas = Number(process.env.IMPRESSORA_COLUNAS || 48);
  const intervalo = Math.max(2, Number(process.env.INTERVALO_SEGUNDOS || 5)) * 1000;
  const imprimir = (bytes) => enviarParaImpressora(bytes, { ip: IMPRESSORA_IP, porta });

  if (!IMPRESSORA_IP) {
    console.error('Falta IMPRESSORA_IP no impressora/.env');
    process.exit(1);
  }
  if (process.argv.includes('--teste')) {
    const texto = ['TESTE DE IMPRESSÃO', new Date().toLocaleString('pt-BR'), '-'.repeat(colunas),
      'Acentos: ação, pão, café, avó, você, Çç ÁÉÍÓÚ ÂÊÔ ÃÕ', regua(colunas), '-'.repeat(colunas)].join('\n');
    imprimir(montarImpressao(texto))
      .then(() => console.log(`Página de teste enviada para ${IMPRESSORA_IP}:${porta}.`))
      .catch((erro) => { console.error(`Não foi possível imprimir: ${erro.message}`); process.exit(1); });
  } else {
    if (!API_URL || !IMPRESSORA_TOKEN) {
      console.error('Falta API_URL ou IMPRESSORA_TOKEN no impressora/.env');
      process.exit(1);
    }
    const ciclo = criarAgente({ apiUrl: API_URL, token: IMPRESSORA_TOKEN, imprimir, colunas });
    console.log(`Agente de impressão ativo: ${API_URL} → ${IMPRESSORA_IP}:${porta}, a cada ${intervalo / 1000}s.`);
    ciclo();
    setInterval(ciclo, intervalo);
  }
}

/** Régua para conferir quantas colunas cabem na bobina (página de teste). */
function regua(colunas) {
  return Array.from({ length: colunas }, (_, i) => String((i + 1) % 10)).join('');
}
