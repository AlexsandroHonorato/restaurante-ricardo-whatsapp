import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ConfirmacaoComponent } from './confirmacao.component';
import { ConfirmacaoService } from './confirmacao.service';

describe('Modal de decisão', () => {
  function montar() {
    TestBed.configureTestingModule({ imports: [ConfirmacaoComponent] });
    const fixture = TestBed.createComponent(ConfirmacaoComponent);
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    // jsdom não implementa showModal/close.
    dialog.showModal = vi.fn(() => dialog.setAttribute('open', ''));
    dialog.close = vi.fn(() => dialog.removeAttribute('open'));
    fixture.detectChanges();
    return { fixture, dialog, servico: TestBed.inject(ConfirmacaoService) };
  }
  const pedido = {
    titulo: 'Excluir prato?',
    mensagem: '"Frango" será removido.',
    confirmar: 'Excluir prato',
    perigo: true,
  };

  it('abre com a pergunta e só executa a ação ao confirmar', () => {
    const { fixture, dialog, servico } = montar();
    const acao = vi.fn();
    servico.pedir(pedido, acao);
    fixture.detectChanges();
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain('Excluir prato?');
    expect(dialog.textContent).toContain('"Frango" será removido.');
    expect(acao).not.toHaveBeenCalled();
    const confirmar = dialog.querySelector('.confirmar') as HTMLButtonElement;
    expect(confirmar.textContent).toContain('Excluir prato');
    expect(confirmar.classList).toContain('perigo');
    confirmar.click();
    fixture.detectChanges();
    expect(acao).toHaveBeenCalledTimes(1);
    expect(dialog.open).toBe(false);
  });

  it('cancelar, Esc ou clicar fora fecham sem executar', () => {
    const { fixture, dialog, servico } = montar();
    const acao = vi.fn();
    servico.pedir(pedido, acao);
    fixture.detectChanges();
    (dialog.querySelector('.cancelar') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(dialog.open).toBe(false);

    servico.pedir(pedido, acao);
    fixture.detectChanges();
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    fixture.detectChanges();
    expect(dialog.open).toBe(false);

    servico.pedir(pedido, acao);
    fixture.detectChanges();
    dialog.click();
    fixture.detectChanges();
    expect(dialog.open).toBe(false);
    expect(acao).not.toHaveBeenCalled();
  });
});
