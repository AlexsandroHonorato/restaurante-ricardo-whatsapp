import { ArcElement, Plugin } from 'chart.js';

/** Pinta arcos com pontas circulares; a série principal fica sobre as junções. */
export const anelSobreposto: Plugin<'doughnut'> = {
  id: 'anelSobreposto',
  beforeDatasetDraw() { return false; },
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const arcos = chart.getDatasetMeta(0).data as ArcElement[];
    const cores = chart.data.datasets[0]?.backgroundColor as string[];
    if (!arcos.length) return;
    ctx.save();
    for (let i = arcos.length - 1; i >= 0; i--) {
      if (!chart.getDataVisibility(i) || Number(chart.data.datasets[0].data[i]) <= 0) continue;
      const arco = arcos[i];
      const {x, y, innerRadius, outerRadius, startAngle, endAngle} = arco;
      if (endAngle <= startAngle) continue;
      ctx.beginPath();
      ctx.strokeStyle = cores[i % cores.length];
      ctx.lineWidth = (outerRadius - innerRadius) * (i === 0 ? 1.12 : 1);
      ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(20,20,35,.3)';
      ctx.shadowBlur = i === 0 ? 7 : 0;
      ctx.shadowOffsetY = i === 0 ? 3 : 0;
      ctx.arc(x, y, (innerRadius + outerRadius) / 2, startAngle, endAngle);
      ctx.stroke();
    }
    ctx.restore();
  },
};
