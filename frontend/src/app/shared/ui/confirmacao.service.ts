import { Injectable, signal } from '@angular/core';

export interface PedidoConfirmacao {
  titulo: string;
  mensagem: string;
  /** Texto do botão que confirma (ex.: "Salvar", "Excluir"). */
  confirmar: string;
  /** Ação que apaga dados: botão de confirmação em vermelho. */
  perigo?: boolean;
}

/** Modal de decisão do painel: toda ação de salvar, editar ou excluir passa por aqui antes de ir à API. */
@Injectable({ providedIn: 'root' })
export class ConfirmacaoService {
  pendente = signal<(PedidoConfirmacao & { aoConfirmar: () => void }) | null>(null);

  pedir(pedido: PedidoConfirmacao, aoConfirmar: () => void) {
    this.pendente.set({ ...pedido, aoConfirmar });
  }

  responder(confirmou: boolean) {
    const pedido = this.pendente();
    this.pendente.set(null);
    if (confirmou) pedido?.aoConfirmar();
  }
}
