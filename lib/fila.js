export function criarFilaPorChave() {
  const filas = new Map();
  return (chave, tarefa) => {
    const anterior = filas.get(chave) || Promise.resolve();
    const atual = anterior.catch(() => {}).then(tarefa);
    filas.set(chave, atual);
    atual.finally(() => { if (filas.get(chave) === atual) filas.delete(chave); }).catch(() => {});
    return atual;
  };
}
