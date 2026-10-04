export function criarMensageiro(graph, { pausa = ms => new Promise(resolve => setTimeout(resolve, ms)), agora = Date.now } = {}) {
  const recebidas = new Map();
  function registrar(telefone, id) {
    for (const [tel, dado] of recebidas) if (agora() - dado.quando > 86400000) recebidas.delete(tel);
    if (recebidas.size >= 2000) recebidas.delete(recebidas.keys().next().value);
    recebidas.set(telefone, { id, quando: agora() });
  }
  async function digitando(telefone) {
    const mensagem = recebidas.get(telefone);
    if (!mensagem || agora() - mensagem.quando > 86400000) return;
    try {
      await graph({ status: 'read', message_id: mensagem.id, typing_indicator: { type: 'text' } });
    } catch (erro) {
      console.warn(JSON.stringify({ evento: 'digitando_indisponivel', erro: erro.message }));
    }
  }
  async function enviar(para, texto) {
    await digitando(para);
    await pausa(700);
    return graph({ recipient_type: 'individual', to: para, type: 'text', text: { preview_url: false, body: texto } });
  }
  return { registrar, digitando, enviar };
}
