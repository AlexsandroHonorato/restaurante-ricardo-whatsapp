import { ArcElement, Plugin } from 'chart.js';

/** Espessura por valor, com os maiores segmentos sobre as junções. */
export const anelSobreposto: Plugin<'doughnut'> = {
  id: 'anelSobreposto',
  beforeDatasetDraw() { return false; },
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const arcos = chart.getDatasetMeta(0).data as ArcElement[];
    const cores = chart.data.datasets[0]?.backgroundColor as string[];
    if (!arcos.length) return;
    const valores = chart.data.datasets[0].data.map(valor => Math.max(0, Number(valor) || 0));
    const ordem = arcos.map((_, i) => i)
      .filter(i => chart.getDataVisibility(i) && valores[i] > 0)
      .sort((a, b) => valores[a] - valores[b]);
    const maior = Math.max(1, ...ordem.map(i => valores[i]));
    ctx.save();
    for (const i of ordem) {
      const arco = arcos[i];
      const {x, y, innerRadius, outerRadius, startAngle, endAngle} = arco;
      if (endAngle <= startAngle) continue;
      ctx.beginPath();
      ctx.strokeStyle = cores[i % cores.length];
      ctx.lineWidth = (outerRadius - innerRadius) * (.5 + .9 * valores[i] / maior);
      ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(20,20,35,.3)';
      ctx.shadowBlur = valores[i] === maior ? 7 : 0;
      ctx.shadowOffsetY = valores[i] === maior ? 3 : 0;
      ctx.arc(x, y, (innerRadius + outerRadius) / 2, startAngle, endAngle);
      ctx.stroke();
    }
    ctx.restore();
  },
};
