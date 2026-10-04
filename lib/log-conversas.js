import { appendFileSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

const HORA = 3600000;
const DIA = 24 * HORA;

// Log de auditoria das conversas (uma linha JSON por resposta). Contém telefones e mensagens de clientes,
// então só guarda os últimos `retencaoDias`; registros mais antigos são apagados no máximo uma vez por hora.
export function criarLogConversas(arquivo, { retencaoDias = 30, agora = Date.now } = {}) {
  let ultimaPoda = -Infinity;

  function podar() {
    if (!existsSync(arquivo)) return;
    const limite = agora() - retencaoDias * DIA;
    const linhas = readFileSync(arquivo, 'utf8').split('\n').filter(Boolean);
    const mantidas = linhas.filter(linha => {
      try { return Date.parse(JSON.parse(linha).quando) >= limite; } catch { return false; }
    });
    if (mantidas.length === linhas.length) return;
    writeFileSync(`${arquivo}.tmp`, mantidas.map(l => l + '\n').join(''), 'utf8');
    renameSync(`${arquivo}.tmp`, arquivo);
  }

  // Erro de disco no log não pode impedir a resposta ao cliente.
  return function registrar(entrada) {
    try {
      if (agora() - ultimaPoda >= HORA) {
        ultimaPoda = agora();
        podar();
      }
      appendFileSync(arquivo, JSON.stringify(entrada) + '\n');
    } catch (erro) {
      console.error(JSON.stringify({ evento: 'log_conversas_indisponivel', erro: erro.message }));
    }
  };
}
