// Caixa de entrada/saída durável do WhatsApp (tabela mensagens_whatsapp, via API).
// Nada é confirmado à Meta antes de gravado; nenhuma resposta se perde se o envio falhar ou o bot reiniciar.
const AVISO_NAO_TEXTO = 'Por enquanto eu só consigo ler mensagens de texto. Pode escrever pra mim? 🙂';

export function criarCaixaPostal({ api, responder, enviarTexto, log = console }) {
  const emAndamento = new Set();

  /** Grava as mensagens recebidas; lança erro se alguma não puder ser gravada (o webhook responde 503). */
  async function receber(mensagens) {
    const novas = [];
    for (const m of mensagens) {
      const { mensagem, duplicada } = await api.registrarEntrada({
        wa_message_id: m.id, telefone: m.from, tipo: m.type, texto: m.type === 'text' ? m.text?.body ?? null : null,
      });
      if (!duplicada) novas.push(mensagem);
    }
    return novas;
  }

  /** Tenta enviar uma saída gravada; em falha a API reagenda com espera crescente. */
  async function enviar(saida) {
    try {
      const resposta = await enviarTexto(saida.telefone, saida.texto);
      await api.atualizar(saida.id, { status: 'enviada', meta_message_id: resposta?.messages?.[0]?.id ?? null });
      return true;
    } catch (erro) {
      log.error(JSON.stringify({ evento: 'envio_whatsapp_falhou', mensagem: saida.id, erro: erro.message }));
      await api.atualizar(saida.id, { status: 'pendente', erro: String(erro.message).slice(0, 255) }).catch(() => {});
      return false;
    }
  }

  /** Gera a resposta de uma entrada, grava a saída (chave resp:<id da Meta>) e envia. */
  async function processar(entrada) {
    emAndamento.add(entrada.id);
    try {
      await api.atualizar(entrada.id, { status: 'processando' });
      const texto = entrada.tipo === 'text'
        ? await responder(entrada.telefone, entrada.texto, { chave: entrada.wa_message_id })
        : AVISO_NAO_TEXTO;
      // Sem texto (limite de mensagens estourado): registra como processada e não responde.
      if (!texto) {
        await api.atualizar(entrada.id, { status: 'processada' });
        return;
      }
      const { mensagem: saida } = await api.criarSaida({ telefone: entrada.telefone, texto, chave: `resp:${entrada.wa_message_id}` });
      await api.atualizar(entrada.id, { status: 'processada' });
      if (saida.status === 'pendente') await enviar(saida);
    } finally {
      emAndamento.delete(entrada.id);
    }
  }

  /** Retoma o que ficou pela metade (bot reiniciado, IA ou API fora do ar) e reenvia saídas vencidas. */
  async function retomar() {
    const { entradas, saidas } = await api.pendentes();
    for (const entrada of entradas) {
      if (emAndamento.has(entrada.id)) continue;
      // Já respondida: a resposta segue na lista de saídas; não gasta a IA de novo.
      if (entrada.respondida) await api.atualizar(entrada.id, { status: 'processada' });
      else await processar(entrada).catch(erro => log.error(JSON.stringify({ evento: 'retomada_falhou', mensagem: entrada.id, erro: erro.message })));
    }
    for (const saida of saidas) await enviar(saida);
  }

  return { receber, enviar, processar, retomar };
}
