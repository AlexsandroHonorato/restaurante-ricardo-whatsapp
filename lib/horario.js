// lib/horario.js: Verificação de horário comercial de atendimento do Restaurante Família Ricardo
// Regra oficial: Segunda a sábado, das 11:00 às 14:30. Domingo fechado.

const FUSO = process.env.FUSO || 'America/Sao_Paulo';

/**
 * Retorna se o restaurante está aberto no momento atual e detalhes do horário.
 */
export function estaAberto(data = new Date()) {
  const formatador = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO,
    weekday: 'short', // Sun, Mon, Tue, Wed, Thu, Fri, Sat
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });

  const partes = formatador.formatToParts(data);
  const mapa = {};
  for (const p of partes) {
    mapa[p.type] = p.value;
  }

  const diaSemana = mapa.weekday; // 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'
  const hora = parseInt(mapa.hour, 10);
  const minuto = parseInt(mapa.minute, 10);
  const minutosDoDia = hora * 60 + minuto;

  // Domingo fechado
  if (diaSemana === 'Sun') {
    return {
      aberto: false,
      motivo: 'domingo',
      mensagem: formatarMensagemFechado('domingo'),
    };
  }

  // 11:00 = 660 minutos | 14:30 = 870 minutos
  const inicioMinutos = 11 * 60;      // 11:00 (660)
  const fimMinutos = 14 * 60 + 30;    // 14:30 (870)

  if (minutosDoDia < inicioMinutos) {
    return {
      aberto: false,
      motivo: 'antes_do_horario',
      mensagem: formatarMensagemFechado('antes_do_horario', hora, minuto),
    };
  }

  if (minutosDoDia > fimMinutos) {
    return {
      aberto: false,
      motivo: 'apos_o_horario',
      mensagem: formatarMensagemFechado('apos_o_horario', hora, minuto),
    };
  }

  return {
    aberto: true,
    motivo: 'horario_comercial',
    mensagem: null,
  };
}

/**
 * Mensagem oficial formatada e acolhedora enviada instantaneamente sem passar pela IA
 */
export function formatarMensagemFechado(motivo, hora, minuto) {
  return `Olá! 🍽️ Seja muito bem-vindo(a) ao *Restaurante Família Ricardo*!\n\n` +
    `No momento estamos *fechados*. ⏳\n\n` +
    `🕒 *Nosso horário de atendimento e entregas:*\n` +
    `• *Segunda a Sábado:* das 11:00 às 14:30\n` +
    `• *Domingo:* Fechado\n\n` +
    `📍 *Endereço:* Av. Irineu Mendes de Souza, 1531, Martim de Sá - Caraguatatuba/SP\n` +
    `📞 *Telefones:* (12) 99750-0045 / (12) 98146-4976\n\n` +
    `Assim que abrirmos nosso atendimento às *11:00*, teremos o maior prazer em te atender e anotar o seu pedido! 😊✨`;
}
