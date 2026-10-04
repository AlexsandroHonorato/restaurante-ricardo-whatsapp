import { ChangeDetectionStrategy, Component, input } from '@angular/core';

let instancias = 0;

/**
 * Símbolo BotClient em SVG com volume: anel com seta de crescimento envolvendo um balão de conversa com rosto de robô.
 * `parte` permite empilhar anel e robô em camadas separadas para a animação 3D do login.
 * Cada instância recebe IDs próprios de gradiente, pois IDs repetidos em SVGs ocultos quebram o preenchimento.
 */
@Component({
  selector: 'app-brand-symbol',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 320 300" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient [attr.id]="id('anel')" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#8f8cff" />
          <stop offset=".45" stop-color="#605cff" />
          <stop offset="1" stop-color="#ff69b4" />
        </linearGradient>
        <linearGradient [attr.id]="id('balao')" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#9d9aff" />
          <stop offset="1" stop-color="#4f4ae6" />
        </linearGradient>
        <linearGradient [attr.id]="id('brilho')" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff" stop-opacity=".55" />
          <stop offset="1" stop-color="#fff" stop-opacity="0" />
        </linearGradient>
      </defs>

      @if (parte() !== 'robo') {
        <g class="anel">
          <path
            class="extrusao"
            d="M230.7 65.7A110 110 0 1 0 263.4 187.6"
            transform="translate(5 8)"
            fill="none"
            stroke="#2b2477"
            stroke-width="34"
          />
          <path
            d="M291.6 197.9 277.1 150 235.2 177.3Z"
            transform="translate(5 8)"
            fill="#2b2477"
            stroke="#2b2477"
            stroke-width="14"
            stroke-linejoin="round"
          />
          <path
            d="M230.7 65.7A110 110 0 1 0 263.4 187.6"
            fill="none"
            [attr.stroke]="url('anel')"
            stroke-width="34"
          />
          <path
            d="M291.6 197.9 277.1 150 235.2 177.3Z"
            fill="#ff69b4"
            stroke="#ff69b4"
            stroke-width="14"
            stroke-linejoin="round"
          />
          <path
            d="M214 56A110 110 0 0 0 58 108"
            fill="none"
            stroke="#fff"
            stroke-opacity=".38"
            stroke-width="7"
            stroke-linecap="round"
          />
        </g>
      }

      @if (parte() !== 'anel') {
        <g class="robo">
          <path
            d="M128 98h64a30 30 0 0 1 30 30v34a30 30 0 0 1-30 30h-44l-26 20 4-22a30 30 0 0 1-28-28v-34a30 30 0 0 1 30-30Z"
            transform="translate(4 7)"
            fill="#2b2477"
          />
          <path
            d="M128 98h64a30 30 0 0 1 30 30v34a30 30 0 0 1-30 30h-44l-26 20 4-22a30 30 0 0 1-28-28v-34a30 30 0 0 1 30-30Z"
            [attr.fill]="url('balao')"
          />
          <rect x="108" y="103" width="104" height="34" rx="17" [attr.fill]="url('brilho')" />
          <path d="M160 98V80" stroke="#b5b2ff" stroke-width="6" stroke-linecap="round" />
          <circle class="antena" cx="160" cy="74" r="8" fill="#2fe5a7" />
          <circle class="olho" cx="138" cy="142" r="11" fill="#2fe5a7" />
          <circle class="olho" cx="182" cy="142" r="11" fill="#2fe5a7" />
          <circle cx="141" cy="139" r="3.5" fill="#fff" fill-opacity=".85" />
          <circle cx="185" cy="139" r="3.5" fill="#fff" fill-opacity=".85" />
          <path
            d="M141 166q19 13 38 0"
            fill="none"
            stroke="#2fe5a7"
            stroke-width="6"
            stroke-linecap="round"
          />
        </g>
      }
    </svg>
  `,
  styles: [
    `
      :host {
        display: block;
        line-height: 0;
      }
      svg {
        width: 100%;
        height: auto;
        overflow: visible;
      }
    `,
  ],
})
export class BrandSymbolComponent {
  readonly parte = input<'tudo' | 'anel' | 'robo'>('tudo');
  private readonly prefixo = `botclient-${++instancias}`;

  protected id(nome: string): string {
    return `${this.prefixo}-${nome}`;
  }

  protected url(nome: string): string {
    return `url(#${this.id(nome)})`;
  }
}
