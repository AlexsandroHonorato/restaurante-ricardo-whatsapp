export const DIAS_CARDAPIO = [
  { valor: 'segunda', nome: 'Segunda-feira' },
  { valor: 'terca', nome: 'Terça-feira' },
  { valor: 'quarta', nome: 'Quarta-feira' },
  { valor: 'quinta', nome: 'Quinta-feira' },
  { valor: 'sexta', nome: 'Sexta-feira' },
  { valor: 'sabado', nome: 'Sábado' },
  { valor: 'domingo', nome: 'Domingo' },
];
export function lerDiasCardapio(valor?: string | null): string[] {
  if (!valor || valor === 'todos') return DIAS_CARDAPIO.map((d) => d.valor);
  const aliases: Record<string, string> = {
    seg: 'segunda',
    ter: 'terca',
    qua: 'quarta',
    qui: 'quinta',
    sex: 'sexta',
    sab: 'sabado',
    dom: 'domingo',
  };
  return valor
    .split(',')
    .map((v) =>
      v
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase(),
    )
    .map((v) => aliases[v] || v);
}
export function gravarDiasCardapio(dias: string[]): string {
  return dias.length === 7
    ? 'todos'
    : DIAS_CARDAPIO.filter((d) => dias.includes(d.valor))
        .map((d) => d.valor)
        .join(',');
}
export function nomeDiasCardapio(valor?: string | null): string {
  return lerDiasCardapio(valor).length === 7
    ? 'Todos os dias'
    : DIAS_CARDAPIO.filter((d) => lerDiasCardapio(valor).includes(d.valor))
        .map((d) => d.nome)
        .join(', ');
}
