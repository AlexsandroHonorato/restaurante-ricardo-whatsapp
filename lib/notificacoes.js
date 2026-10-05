import { createHash } from 'node:crypto';

/**
 * Notificações do painel (/api/notificar). `enviar(para, texto, chave)` grava a saída durável pela chave
 * (banco garante uma única mensagem por chave) e tenta enviar: { enviado, repetido? }.
 * A trava em memória só evita dois envios simultâneos da mesma chave neste processo.
 */
export function criarNotificador(enviar) {
  const emAndamento = new Map();
  return async ({ para, texto, idempotency_key }) => {
    if (typeof para !== 'string' || !/^\d{10,15}$/.test(para) ||
        typeof texto !== 'string' || !texto.trim() || texto.length > 4096 ||
        (idempotency_key !== undefined && (typeof idempotency_key !== 'string' || !idempotency_key || idempotency_key.length > 150))) {
      throw new TypeError('Destinatário, texto ou chave de idempotência inválidos');
    }
    const chave = idempotency_key || 'notif:' + createHash('sha256').update(`${para}:${texto}`).digest('hex');
    if (emAndamento.has(chave)) {
      const anterior = await emAndamento.get(chave);
      return anterior.enviado ? { ok: true, repetido: true } : { ok: false, pendente: true };
    }
    const envio = Promise.resolve().then(() => enviar(para, texto, chave));
    emAndamento.set(chave, envio);
    try {
      const resultado = await envio;
      if (resultado.repetido) return { ok: true, repetido: true };
      // Não confirmado: a mensagem continua na fila e é reenviada automaticamente.
      return resultado.enviado ? { ok: true, enviado: true, para } : { ok: false, pendente: true };
    } finally {
      emAndamento.delete(chave);
    }
  };
}
