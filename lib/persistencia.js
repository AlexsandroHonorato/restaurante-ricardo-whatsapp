import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';

export function lerJson(arquivo) {
  if (!existsSync(arquivo)) return {};
  const dados = JSON.parse(readFileSync(arquivo, 'utf8'));
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
    throw new Error(`Arquivo de dados inválido: ${arquivo}`);
  }
  return dados;
}

// Uma falha na escrita não deve truncar o último estado válido.
export function gravarJson(arquivo, dados) {
  const temporario = `${arquivo}.tmp`;
  writeFileSync(temporario, JSON.stringify(dados, null, 2), 'utf8');
  renameSync(temporario, arquivo);
}
