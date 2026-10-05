// Limite de mensagens por telefone para proteger os créditos da IA contra abuso ou loop.
// 'ok' = segue; 'avisar' = primeira mensagem acima do limite (responde pedindo para aguardar); 'silencio' = ignora.
const MINUTO = 60000;
const HORA = 60 * MINUTO;

export function criarLimitador({ porMinuto = 8, porHora = 60, agora = Date.now, maxTelefones = 5000 } = {}) {
  const historico = new Map(); // telefone -> { horarios: number[], avisado: boolean }

  function verificar(telefone) {
    const instante = agora();
    let registro = historico.get(telefone);
    if (!registro) {
      if (historico.size >= maxTelefones) historico.delete(historico.keys().next().value);
      registro = { horarios: [], avisado: false };
      historico.set(telefone, registro);
    }
    registro.horarios = registro.horarios.filter(h => instante - h < HORA);
    const noMinuto = registro.horarios.filter(h => instante - h < MINUTO).length;
    if (noMinuto >= porMinuto || registro.horarios.length >= porHora) {
      if (registro.avisado) return 'silencio';
      registro.avisado = true;
      return 'avisar';
    }
    registro.avisado = false;
    registro.horarios.push(instante);
    return 'ok';
  }

  return { verificar, tamanho: () => historico.size };
}
