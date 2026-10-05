export function cabecalhosApiBot() {
  return { Accept: 'application/json', Authorization: 'Bearer ' + (process.env.NOTIFICACAO_TOKEN || '') };
}

const base = () => (process.env.API_BASE_URL || 'http://127.0.0.1:8080/api').replace(/\/$/, '');

async function chamar(metodo, caminho, corpo) {
  const resposta = await fetch(base() + caminho, {
    method: metodo, signal: AbortSignal.timeout(8000),
    headers: { ...cabecalhosApiBot(), ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (!resposta.ok) throw new Error(`API ${metodo} ${caminho.split('/').slice(0, 4).join('/')} retornou ${resposta.status}`);
  return resposta.json();
}

/** Rotas internas do bot no Laravel (BotAccess): mensagens duráveis e estado da conversa. */
export const apiBot = {
  registrarEntrada: mensagem => chamar('POST', '/bot/mensagens/entrada', mensagem),
  criarSaida: mensagem => chamar('POST', '/bot/mensagens/saida', mensagem),
  atualizar: (id, dados) => chamar('PATCH', `/bot/mensagens/${id}`, dados),
  pendentes: () => chamar('GET', '/bot/mensagens/pendentes'),
  conversa: telefone => chamar('GET', `/bot/conversas/${telefone}`),
  empresa: () => chamar('GET', '/bot/empresa'),
  pausado: async telefone => (await chamar('GET', `/bot/conversas/${telefone}/pausa`)).pausado === true,
};
