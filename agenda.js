// agenda.js: passo 6. Sem CAL_API_KEY no .env, roda uma agenda de DEMONSTRAÇÃO na memória (para testar no terminal).
// Com CAL_API_KEY e CAL_EVENT_TYPE_ID, usa a API v2 do Cal.com de verdade.
const CAL = 'https://api.cal.com/v2';

// ---------------------------------------------------------------- agenda de demonstração
const demoMarcados = new Set();
const demo = {
  async horariosLivres(data) {
    const [a, m, d] = data.split('-').map(Number);
    const dia = new Date(Date.UTC(a, m - 1, d)).getUTCDay(); // 0 = domingo
    if (dia === 0 || dia === 1) return [];                  // fechado domingo e segunda (igual à ficha de exemplo)
    const todas = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:30', '18:00'];
    return todas.filter((h, i) => (d + i) % 3 !== 0 && !demoMarcados.has(`${data} ${h}`));
  },
  async marcar({ data, hora }) {
    demoMarcados.add(`${data} ${hora}`);
    return { id: `demo-${data}-${hora}` };
  },
};

// ---------------------------------------------------------------- Cal.com (API v2)
const cabecalho = (versao) => ({
  Authorization: `Bearer ${process.env.CAL_API_KEY}`,
  'cal-api-version': versao,
  'Content-Type': 'application/json',
});
const horaLocal = (iso, fuso) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));

// deslocamento do fuso naquele dia, ex.: "-03:00" (sem biblioteca de datas)
function offset(data, fuso) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: fuso, timeZoneName: 'longOffset' }).formatToParts(new Date(`${data}T12:00:00Z`));
  const o = p.find((x) => x.type === 'timeZoneName').value.replace('GMT', '');
  return o === '' ? '+00:00' : o;
}

const calcom = {
  async horariosLivres(data, fuso) {
    const o = offset(data, fuso);
    const q = new URLSearchParams({
      eventTypeId: process.env.CAL_EVENT_TYPE_ID,
      start: new Date(`${data}T00:00:00${o}`).toISOString(), // o Cal.com quer início e fim em UTC
      end: new Date(`${data}T23:59:59${o}`).toISOString(),
      timeZone: fuso,
    });
    const r = await fetch(`${CAL}/slots?${q}`, { headers: cabecalho('2024-09-04') });
    const j = await r.json();
    if (!r.ok) throw new Error(`Cal.com slots ${r.status}: ${JSON.stringify(j.error ?? j)}`);
    return Object.values(j.data ?? {}).flat().map((s) => horaLocal(s.start, fuso));
  },
  async marcar({ data, hora, nome, servico, telefone, fuso }) {
    const inicio = new Date(`${data}T${hora}:00${offset(data, fuso)}`).toISOString(); // o Cal.com quer o início em UTC
    const corpo = {
      start: inicio,
      eventTypeId: Number(process.env.CAL_EVENT_TYPE_ID),
      attendee: {
        name: nome,
        // o WhatsApp não traz e-mail: no Cal.com, deixe o telefone obrigatório e o e-mail opcional no tipo de evento
        ...(process.env.CAL_EMAIL_PADRAO ? { email: process.env.CAL_EMAIL_PADRAO } : {}),
        timeZone: fuso,
        phoneNumber: `+${telefone.replace(/\D/g, '')}`,
        language: 'pt-BR',
      },
      bookingFieldsResponses: { notes: `${servico} · agendado pelo WhatsApp` },
    };
    const r = await fetch(`${CAL}/bookings`, { method: 'POST', headers: cabecalho('2026-02-25'), body: JSON.stringify(corpo) });
    const j = await r.json();
    if (!r.ok) throw new Error(`Cal.com booking ${r.status}: ${JSON.stringify(j.error ?? j)}`);
    return { id: j.data?.uid ?? j.data?.id };
  },
};

export const agenda = process.env.CAL_API_KEY ? calcom : demo;
export const modoAgenda = process.env.CAL_API_KEY ? 'Cal.com' : 'demonstração (sem Cal.com)';
