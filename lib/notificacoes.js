import { createHash } from 'node:crypto';

export function criarNotificador(enviar, ttl = 600000) {
  const enviadas = new Map();
  const pendentes = new Map();
  return async ({ para, texto, idempotency_key }) => {
    if (typeof para !== 'string' || !/^\d{10,15}$/.test(para) ||
        typeof texto !== 'string' || !texto.trim() || texto.length > 4096 ||
        (idempotency_key !== undefined && (typeof idempotency_key !== 'string' || idempotency_key.length > 200))) {
      throw new TypeError('Destinatário, texto ou chave de idempotência inválidos');
    }
    const chave = idempotency_key || createHash('sha256').update(`${para}:${texto}`).digest('hex');
    const agora = Date.now();
    for (const [k, expira] of enviadas) if (expira <= agora) enviadas.delete(k);
    if (enviadas.has(chave)) return { ok: true, repetido: true };
    if (pendentes.has(chave)) {
      await pendentes.get(chave);
      return { ok: true, repetido: true };
    }
    const envio = Promise.resolve().then(() => enviar(para, texto));
    pendentes.set(chave, envio);
    try {
      await envio;
      enviadas.set(chave, Date.now() + ttl);
      return { ok: true, enviado: true, para };
    } finally {
      pendentes.delete(chave);
    }
  };
}
