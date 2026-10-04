// Dados da empresa atendida por esta instância do bot. Cada empresa roda o bot com o próprio .env.
export const EMPRESA = {
  nome: process.env.EMPRESA_NOME || 'Restaurante Família Ricardo',
  telefone: process.env.EMPRESA_TELEFONE || '(12) 99750-0045',
  telefoneAlternativo: process.env.EMPRESA_TELEFONE_2 || '(12) 98146-4976',
};
