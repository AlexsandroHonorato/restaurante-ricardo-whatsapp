import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import { BrandSymbolComponent } from './brand-symbol.component';

/* Ambientes de teste podem não implementar matchMedia. */
const combina = (consulta: string) =>
  typeof matchMedia === 'function' && matchMedia(consulta).matches;

/** Logo BotClient em camadas: o anel e o robô entram em 3D, as letras tombam em sequência e o conjunto inclina com o mouse. */
@Component({
  selector: 'app-animated-logo',
  imports: [BrandSymbolComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './animated-logo.component.html',
  styleUrl: './animated-logo.component.css',
})
export class AnimatedLogoComponent {
  readonly animar = input(true);
  readonly pausado = input(false);
  /** Só símbolo e nome, para espaços pequenos como o login no celular. */
  readonly compacto = input(false);

  protected readonly letrasBot = [...'Bot'];
  protected readonly letrasClient = [...'Client'];

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly alvo = { rx: 0, ry: 0, pop: 0 };
  private readonly atual = { rx: 0, ry: 0, pop: 0 };
  private quadro = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.quadro));
  }

  protected aoMoverPonteiro(evento: PointerEvent): void {
    if (
      evento.pointerType !== 'mouse' ||
      this.pausado() ||
      !combina('(hover: hover) and (pointer: fine)') ||
      combina('(prefers-reduced-motion: reduce)')
    )
      return;
    const area = this.host.getBoundingClientRect();
    const x = (evento.clientX - area.left) / area.width - 0.5;
    const y = (evento.clientY - area.top) / area.height - 0.5;
    this.alvo.rx = -y * 16;
    this.alvo.ry = x * 20;
    this.alvo.pop = 1;
    this.mover();
  }

  protected aoSairPonteiro(): void {
    this.alvo.rx = 0;
    this.alvo.ry = 0;
    this.alvo.pop = 0;
    this.mover();
  }

  /* Aproxima suavemente a inclinação do ponteiro e separa as camadas em profundidade. */
  private mover(): void {
    if (this.quadro) return;
    const passo = () => {
      let movendo = false;
      for (const chave of ['rx', 'ry', 'pop'] as const) {
        const diferenca = this.alvo[chave] - this.atual[chave];
        if (Math.abs(diferenca) > 0.001) movendo = true;
        this.atual[chave] += diferenca * 0.1;
      }
      const estilo = this.host.style;
      estilo.setProperty('--rx', `${this.atual.rx.toFixed(3)}deg`);
      estilo.setProperty('--ry', `${this.atual.ry.toFixed(3)}deg`);
      estilo.setProperty('--pop', this.atual.pop.toFixed(4));
      this.quadro = movendo ? requestAnimationFrame(passo) : 0;
    };
    this.quadro = requestAnimationFrame(passo);
  }
}
