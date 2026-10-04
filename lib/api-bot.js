export function cabecalhosApiBot() {
  return { Accept: 'application/json', Authorization: 'Bearer ' + (process.env.NOTIFICACAO_TOKEN || '') };
}
