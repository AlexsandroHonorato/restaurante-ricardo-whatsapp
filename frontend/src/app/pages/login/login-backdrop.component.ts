import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';

/* Paleta da marca (mesmos tokens de design-system.css). */
const LAVANDA = [181, 178, 255];
const ROXO = [96, 92, 255];
const ROSA = [255, 105, 180];
const VERDE = [47, 229, 167];

interface Estrela {
  x: number;
  y: number;
  z: number;
  cor: number[];
}
interface Orbita {
  raio: number;
  inclinacao: number;
  giro: number;
  velocidade: number;
  cometas: number[];
  cor: number[];
}

const combina = (consulta: string) =>
  typeof matchMedia === 'function' && matchMedia(consulta).matches;

/**
 * Cenário 3D do painel da marca no login.
 * Canvas de trás: partículas vindo em direção ao usuário + metade distante das órbitas.
 * Canvas da frente (acima do logo): metade próxima das órbitas, para os cometas passarem na frente do logo.
 */
@Component({
  selector: 'app-login-backdrop',
  template: `
    <div class="aurora" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="holofote" aria-hidden="true"></div>
    <canvas #tras class="camada-tras" aria-hidden="true"></canvas>
    <ng-content />
    <canvas #frente class="camada-frente" aria-hidden="true"></canvas>
  `,
  styleUrl: './login-backdrop.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.pausado]': 'pausado()',
    '(pointermove)': 'aoMoverPonteiro($event)',
    '(pointerleave)': 'aoSairPonteiro()',
  },
})
export class LoginBackdropComponent implements AfterViewInit {
  readonly pausado = input(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly trasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('tras');
  private readonly frenteRef = viewChild.required<ElementRef<HTMLCanvasElement>>('frente');
  private tras?: CanvasRenderingContext2D | null;
  private frente?: CanvasRenderingContext2D | null;
  private largura = 0;
  private altura = 0;
  private quadro = 0;
  private ultimo = 0;
  private tempo = 0;
  private readonly ponteiro = { x: 0, y: 0, alvoX: 0, alvoY: 0 };
  private readonly estrelas: Estrela[] = [];
  private readonly orbitas: Orbita[] = [
    { raio: 0.4, inclinacao: 1.22, giro: -0.2, velocidade: 0.34, cometas: [0], cor: ROXO },
    { raio: 0.47, inclinacao: 1.3, giro: 0.14, velocidade: -0.24, cometas: [1.4, 4.5], cor: ROSA },
  ];

  constructor() {
    const destroyRef = inject(DestroyRef);
    const redimensionar =
      typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.redimensionar()) : null;
    const aoMudarVisibilidade = () => this.sincronizar();
    destroyRef.onDestroy(() => {
      cancelAnimationFrame(this.quadro);
      redimensionar?.disconnect();
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    });
    queueMicrotask(() => redimensionar?.observe(this.host));
    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    effect(() => {
      this.pausado();
      this.sincronizar();
    });
  }

  ngAfterViewInit(): void {
    this.tras = this.trasRef().nativeElement.getContext('2d');
    this.frente = this.frenteRef().nativeElement.getContext('2d');
    for (let i = 0; i < 170; i++) this.estrelas.push(this.criarEstrela(Math.random()));
    this.redimensionar();
  }

  protected aoMoverPonteiro(evento: PointerEvent): void {
    if (evento.pointerType !== 'mouse') return;
    const area = this.host.getBoundingClientRect();
    this.ponteiro.alvoX = (evento.clientX - area.left) / area.width - 0.5;
    this.ponteiro.alvoY = (evento.clientY - area.top) / area.height - 0.5;
  }

  protected aoSairPonteiro(): void {
    this.ponteiro.alvoX = 0;
    this.ponteiro.alvoY = 0;
  }

  private get parado(): boolean {
    return this.pausado() || document.hidden || combina('(prefers-reduced-motion: reduce)');
  }

  private sincronizar(): void {
    cancelAnimationFrame(this.quadro);
    this.quadro = 0;
    if (!this.tras) return;
    if (this.parado) {
      this.desenhar(0);
      return;
    }
    this.ultimo = performance.now();
    const tique = (agora: number) => {
      this.desenhar(Math.min((agora - this.ultimo) / 1000, 0.05));
      this.ultimo = agora;
      this.quadro = requestAnimationFrame(tique);
    };
    this.quadro = requestAnimationFrame(tique);
  }

  private redimensionar(): void {
    const area = this.host.getBoundingClientRect();
    if (!area.width || !this.tras || !this.frente) return;
    this.largura = area.width;
    this.altura = area.height;
    const densidade = Math.min(devicePixelRatio || 1, 1.75);
    for (const ctx of [this.tras, this.frente]) {
      ctx.canvas.width = Math.round(this.largura * densidade);
      ctx.canvas.height = Math.round(this.altura * densidade);
      ctx.setTransform(densidade, 0, 0, densidade, 0, 0);
    }
    this.sincronizar();
  }

  private criarEstrela(z = 1): Estrela {
    const sorteio = Math.random();
    return {
      x: (Math.random() - 0.5) * 2.4,
      y: (Math.random() - 0.5) * 2.4,
      z: Math.max(z, 0.02),
      cor: sorteio < 0.45 ? LAVANDA : sorteio < 0.75 ? ROXO : sorteio < 0.9 ? ROSA : VERDE,
    };
  }

  private desenhar(delta: number): void {
    const tras = this.tras;
    const frente = this.frente;
    if (!tras || !frente) return;
    const { largura: w, altura: h } = this;
    this.tempo += delta;
    this.ponteiro.x += (this.ponteiro.alvoX - this.ponteiro.x) * Math.min(delta * 3, 1);
    this.ponteiro.y += (this.ponteiro.alvoY - this.ponteiro.y) * Math.min(delta * 3, 1);

    tras.clearRect(0, 0, w, h);
    frente.clearRect(0, 0, w, h);
    tras.globalCompositeOperation = 'lighter';
    frente.globalCompositeOperation = 'lighter';

    // Partículas vindo em direção ao usuário, com paralaxe de profundidade no ponteiro.
    const cx = w * 0.5 - this.ponteiro.x * 30;
    const cy = h * 0.44 - this.ponteiro.y * 24;
    const focal = Math.min(w, h) * 0.55;
    for (let i = 0; i < this.estrelas.length; i++) {
      const estrela = this.estrelas[i];
      estrela.z -= delta * 0.07;
      if (estrela.z <= 0.02) {
        this.estrelas[i] = this.criarEstrela();
        continue;
      }
      const sx = cx + (estrela.x / estrela.z) * focal;
      const sy = cy + (estrela.y / estrela.z) * focal;
      if (sx < -20 || sx > w + 20 || sy < -20 || sy > h + 20) {
        this.estrelas[i] = this.criarEstrela();
        continue;
      }
      const perto = 1 - estrela.z;
      const alfa = Math.min(perto * 1.3, 1) * Math.min(estrela.z * 6, 1) * 0.85;
      const tamanho = 0.4 + perto * perto * 2.6;
      const [r, g, b] = estrela.cor;
      tras.fillStyle = `rgba(${r},${g},${b},${alfa.toFixed(3)})`;
      tras.beginPath();
      tras.arc(sx, sy, tamanho, 0, Math.PI * 2);
      tras.fill();
      if (perto > 0.75) {
        // rastro de luz nas partículas mais próximas
        tras.strokeStyle = `rgba(${r},${g},${b},${(alfa * 0.35).toFixed(3)})`;
        tras.lineWidth = tamanho * 0.8;
        tras.beginPath();
        tras.moveTo(sx, sy);
        tras.lineTo(cx + (sx - cx) * 0.93, cy + (sy - cy) * 0.93);
        tras.stroke();
      }
    }

    // Órbitas ao redor do logo; a metade mais próxima do usuário vai para o canvas da frente.
    const ox = w * 0.5 + this.ponteiro.x * 16;
    const oy = h * 0.4 + this.ponteiro.y * 12;
    const base = Math.min(w, h * 1.1);
    for (const orbita of this.orbitas) {
      const inclinacao = orbita.inclinacao + this.ponteiro.y * 0.18;
      const giro = orbita.giro + this.ponteiro.x * 0.12;
      const raio = orbita.raio * base;
      const projetar = (angulo: number) => {
        const x0 = Math.cos(angulo) * raio;
        const z0 = Math.sin(angulo) * raio;
        const y1 = -z0 * Math.cos(inclinacao);
        const z1 = z0 * Math.sin(inclinacao);
        const x2 = x0 * Math.cos(giro) - y1 * Math.sin(giro);
        const y2 = x0 * Math.sin(giro) + y1 * Math.cos(giro);
        const escala = 900 / (900 - z1 * 0.9);
        return { x: ox + x2 * escala, y: oy + y2 * escala, profundidade: z1 / raio, escala };
      };
      const [r, g, b] = orbita.cor;
      const passos = 180;
      let anterior = projetar(0);
      for (let s = 1; s <= passos; s++) {
        const ponto = projetar((s / passos) * Math.PI * 2);
        const ctx = (anterior.profundidade + ponto.profundidade) / 2 > 0 ? frente : tras;
        ctx.strokeStyle = `rgba(${r},${g},${b},${(0.1 + (ponto.profundidade + 1) * 0.06).toFixed(3)})`;
        ctx.lineWidth = 0.8 + (ponto.profundidade + 1) * 0.35;
        ctx.beginPath();
        ctx.moveTo(anterior.x, anterior.y);
        ctx.lineTo(ponto.x, ponto.y);
        ctx.stroke();
        anterior = ponto;
      }
      for (const deslocamento of orbita.cometas) {
        const cabeca = deslocamento + this.tempo * orbita.velocidade;
        const direcao = Math.sign(orbita.velocidade) || 1;
        const cauda = 1.1;
        for (let k = 0; k < 36; k++) {
          const t = k / 36;
          const p0 = projetar(cabeca - direcao * t * cauda);
          const p1 = projetar(cabeca - direcao * (t + 1 / 36) * cauda);
          const ctx = p0.profundidade > 0 ? frente : tras;
          const esmaecer = (1 - t) ** 2;
          const clarear = (canal: number) => Math.round(canal + (255 - canal) * esmaecer * 0.6);
          ctx.strokeStyle = `rgba(${clarear(r)},${clarear(g)},${clarear(b)},${(esmaecer * 0.9).toFixed(3)})`;
          ctx.lineWidth = (1 + esmaecer * 3.2) * p0.escala;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
        }
        const p = projetar(cabeca);
        const ctx = p.profundidade > 0 ? frente : tras;
        const brilho = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 16 * p.escala);
        brilho.addColorStop(0, 'rgba(255,255,255,.95)');
        brilho.addColorStop(0.25, `rgba(${LAVANDA[0]},${LAVANDA[1]},${LAVANDA[2]},.55)`);
        brilho.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = brilho;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 16 * p.escala, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
