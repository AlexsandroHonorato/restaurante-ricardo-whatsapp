export function converterValor(valor) {
  let texto = String(valor ?? '').replace(/R\$|\s/g, '');
  if (texto.includes(',')) texto = texto.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(texto)) throw new Error('Valor monetário inválido');
  return Number(texto);
}

export function validarItensTotal(itens, total) {
  const soma = itens.reduce((centavos, item) => {
    const partes = item.match(/^(?:(\d+)\s*x\s*)?(.+?)\s*-\s*R\$\s*([\d.,]+)\s*$/iu);
    if (!partes) throw new Error('Cada item deve informar nome, quantidade e preço unitário');
    const quantidade = Number(partes[1] || 1);
    const preco = Math.round(converterValor(partes[3]) * 100);
    if (quantidade < 1 || quantidade > 100 || preco <= 0) throw new Error('Quantidade ou preço inválido');
    return centavos + quantidade * preco;
  }, 0);
  if (soma !== Math.round(converterValor(total) * 100)) throw new Error('Total não corresponde aos itens do pedido');
}
