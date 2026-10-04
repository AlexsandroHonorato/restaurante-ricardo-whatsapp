import { cabecalhosApiBot } from './api-bot.js';
const DIAS = ['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo'];
const INDISPONIVEL = 'Olá! 🍽️ Não conseguimos consultar nosso horário de atendimento agora. Por favor, tente novamente em alguns instantes. Obrigado pela compreensão!';

export function avaliarHorario(agenda, agora = new Date()) {
  const horarios = agenda?.horarios;
  const horaValida = valor => typeof valor === 'string' && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(valor);
  if (!agenda?.fuso || !Array.isArray(horarios) || horarios.length !== 7 || new Set(horarios.map(h => h.dia_semana)).size !== 7 || horarios.some(h => !Number.isInteger(h.dia_semana) || h.dia_semana < 1 || h.dia_semana > 7 || typeof h.ativo !== 'boolean' || (h.ativo && (!horaValida(h.hora_inicio) || !horaValida(h.hora_fim) || h.hora_inicio >= h.hora_fim)))) {
    throw new Error('Agenda de atendimento inválida');
  }
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: agenda.fuso, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(agora).map(p => [p.type, p.value]));
  const dia = new Date(Date.UTC(Number(partes.year), Number(partes.month) - 1, Number(partes.day))).getUTCDay() || 7;
  const hora = `${partes.hour}:${partes.minute}:${partes.second}`;
  const hoje = horarios.find(h => h.dia_semana === dia);
  const normalizar = valor => valor.length === 5 ? `${valor}:00` : valor;
  if (hoje.ativo && hora >= normalizar(hoje.hora_inicio) && hora < normalizar(hoje.hora_fim)) return { aberto: true, mensagem: null };
  let proximo;
  for (let distancia = 0; distancia <= 7; distancia++) {
    const horario = horarios.find(h => h.dia_semana === (dia - 1 + distancia) % 7 + 1);
    if (horario.ativo && (distancia > 0 || hora < normalizar(horario.hora_inicio))) { proximo = horario; break; }
  }
  const retorno = proximo ? ` Nosso próximo atendimento será ${DIAS[proximo.dia_semana - 1]}, das ${proximo.hora_inicio.slice(0, 5)} às ${proximo.hora_fim.slice(0, 5)} (horário de São Paulo).` : ' Estamos temporariamente sem horários de atendimento disponíveis.';
  return { aberto: false, mensagem: `Olá! 🍽️ No momento estamos fora do horário de atendimento.${retorno} Será um prazer atender você quando voltarmos!` };
}

export async function consultarAtendimento() {
  try {
    const base = (process.env.API_BASE_URL || 'http://127.0.0.1:8080/api').replace(/\/$/, '');
    const resposta = await fetch(`${base}/bot/horarios-atendimento`, { headers: cabecalhosApiBot(), signal: AbortSignal.timeout(5000) });
    if (!resposta.ok) {
      await resposta.text().catch(() => '');
      throw new Error(`HTTP ${resposta.status}`);
    }
    return avaliarHorario(await resposta.json());
  } catch (erro) {
    console.error(JSON.stringify({ evento: 'agenda_atendimento_indisponivel', erro: erro.message }));
    return { aberto: false, mensagem: INDISPONIVEL };
  }
}
