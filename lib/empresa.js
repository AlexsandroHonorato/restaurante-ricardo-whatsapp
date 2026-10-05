// Dados da empresa atendida por esta instância do bot.
// Fonte: ficha editada no painel (Configurações → Dados da empresa). Sem nome cadastrado lá, usa o .env.
const PADRAO = {
  nome: process.env.EMPRESA_NOME || 'Restaurante Família Ricardo',
  telefone: process.env.EMPRESA_TELEFONE || '(12) 99750-0045',
  telefoneAlternativo: process.env.EMPRESA_TELEFONE_2 || '(12) 98146-4976',
};
let ficha = null;

export const EMPRESA = {
  get nome() { return ficha?.nome || PADRAO.nome; },
  get telefone() { return ficha ? ficha.telefone || '' : PADRAO.telefone; },
  get telefoneAlternativo() { return ficha ? ficha.telefone_2 || '' : PADRAO.telefoneAlternativo; },
  get tipo() { return ficha?.tipo_negocio || process.env.EMPRESA_TIPO || 'restaurante'; },
};

/** Aplica a ficha vinda da API; sem nome cadastrado no painel, volta aos valores do .env. */
export function definirFicha(dados) {
  ficha = dados?.nome ? { nome: dados.nome, telefone: dados.telefone, telefone_2: dados.telefone_2, tipo_negocio: dados.tipo_negocio } : null;
}
