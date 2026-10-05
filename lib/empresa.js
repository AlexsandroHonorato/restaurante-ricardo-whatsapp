// Dados da empresa atendida por esta instância do bot.
// Fonte: ficha editada no painel (Configurações → Dados da empresa). Sem nome cadastrado lá, usa o .env.
const PADRAO = {
  nome: process.env.EMPRESA_NOME || 'Restaurante Família Ricardo',
  telefone: process.env.EMPRESA_TELEFONE || '(12) 99750-0045',
  telefoneAlternativo: process.env.EMPRESA_TELEFONE_2 || '(12) 98146-4976',
};
let ficha = null;
// Tempos para mensagens entregues com atraso pela Meta (Configurações → Dados da empresa); valem mesmo sem nome cadastrado.
let tempos = {};
const minutos = (valor, padrao) => (Number.isInteger(valor) && valor > 0 ? valor : padrao);

export const EMPRESA = {
  get nome() { return ficha?.nome || PADRAO.nome; },
  get telefone() { return ficha ? ficha.telefone || '' : PADRAO.telefone; },
  get telefoneAlternativo() { return ficha ? ficha.telefone_2 || '' : PADRAO.telefoneAlternativo; },
  get tipo() { return ficha?.tipo_negocio || process.env.EMPRESA_TIPO || 'restaurante'; },
  get minutosMensagemAntiga() { return minutos(tempos.antiga, 10); },
  get minutosFilaAcumulada() { return minutos(tempos.fila, 1); },
};

/** Aplica a ficha vinda da API; sem nome cadastrado no painel, volta aos valores do .env. */
export function definirFicha(dados) {
  tempos = { antiga: dados?.minutos_mensagem_antiga, fila: dados?.minutos_fila_acumulada };
  ficha = dados?.nome ? { nome: dados.nome, telefone: dados.telefone, telefone_2: dados.telefone_2, tipo_negocio: dados.tipo_negocio } : null;
}
