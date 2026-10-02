import { createHmac, timingSafeEqual } from 'node:crypto';

export function assinaturaValida(bruto, cabecalho, segredo) {
  if (!segredo || segredo.includes('cole-aqui') || typeof cabecalho !== 'string') return false;
  const esperado = 'sha256=' + createHmac('sha256', segredo).update(bruto).digest('hex');
  const a = Buffer.from(esperado), b = Buffer.from(cabecalho);
  return a.length === b.length && timingSafeEqual(a, b);
}
