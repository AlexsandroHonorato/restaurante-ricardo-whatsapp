import { createHmac, timingSafeEqual } from 'node:crypto';

function iguais(esperado, recebido) {
  const a = Buffer.from(esperado), b = Buffer.from(recebido);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function assinaturaValida(bruto, cabecalho, segredo) {
  if (typeof segredo !== 'string' || !segredo.trim()) return false;
  if (typeof cabecalho !== 'string') return false;
  try {
    return iguais('sha256=' + createHmac('sha256', segredo).update(bruto).digest('hex'), cabecalho);
  } catch {
    return false;
  }
}

/**
 * Reentrega tardia: a Meta reenvia por horas (até dias) o webhook que não foi aceito na hora.
 * Mensagem enviada pelo cliente há mais de 10 minutos não é respondida. Sem horário válido, vale como nova.
 */
export function mensagemAntiga(msg, agora = Date.now(), limiteMs = 10 * 60 * 1000) {
  const enviadaEm = Number(msg?.timestamp) * 1000;
  return Number.isFinite(enviadaEm) && enviadaEm > 0 && agora - enviadaEm > limiteMs;
}

// Sem token configurado a rota fica fechada: um túnel encaminha chamadas externas como se fossem locais.
export function notificacaoAutorizada(cabecalho, token) {
  if (typeof token !== 'string' || !token.trim() || typeof cabecalho !== 'string') return false;
  return iguais(`Bearer ${token}`, cabecalho);
}
