import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { PedidosComponent } from './pedidos.component';
import { ApiService } from '../../core/services/api.service';
import { Pedido } from '../../core/models/dashboard.model';
const pedido={id:3,codigo_pedido:'PED-TESTE',status:'em_preparo'} as Pedido;
describe('Modal de cancelamento',()=>{
 function preparar(){
  const resposta=new Subject<unknown>();const atualizar=vi.fn(()=>resposta);
  TestBed.configureTestingModule({imports:[PedidosComponent],providers:[{provide:ApiService,useValue:{getPedidos:()=>of({data:[]}),getKpis:()=>of({}),updatePedidoStatus:atualizar}}]});
  const f=TestBed.createComponent(PedidosComponent);f.detectChanges();const dialog=f.nativeElement.querySelector('dialog') as HTMLDialogElement;
  // JSDOM não implementa o comportamento nativo de dialog; foco/Escape são verificados no navegador.
  dialog.showModal=vi.fn(()=>dialog.setAttribute('open',''));dialog.close=vi.fn(()=>dialog.removeAttribute('open'));
  return {f,c:f.componentInstance,dialog,resposta,atualizar};
 }
 it('abre um dialog, bloqueia motivo vazio e encerra sem gravar ao voltar',()=>{
  const {f,c,dialog,atualizar}=preparar();c.abrirCancelamento(pedido);f.detectChanges();expect(dialog.open).toBe(true);expect(dialog.getAttribute('aria-labelledby')).toBe('cancelamento-titulo');c.confirmarCancelamento();expect(atualizar).not.toHaveBeenCalled();c.fecharCancelamento();expect(dialog.open).toBe(false);expect(c.cancelando()).toBe(null);
 });
 it('mantém motivo e modal em erro, impede duplicidade e fecha após sucesso',()=>{
  const {f,c,dialog,resposta,atualizar}=preparar();c.abrirCancelamento(pedido);c.motivoCancelamento='Cliente desistiu';c.confirmarCancelamento();c.confirmarCancelamento();expect(atualizar).toHaveBeenCalledTimes(1);expect(atualizar).toHaveBeenCalledWith(3,'cancelado','Cliente desistiu');const evento=new Event('cancel',{cancelable:true});c.aoCancelarDialog(evento);expect(evento.defaultPrevented).toBe(true);resposta.error(new Error('Erro'));f.detectChanges();expect(c.motivoCancelamento).toBe('Cliente desistiu');expect(dialog.open).toBe(true);expect(c.erroCancelamento()).toBeTruthy();const sucesso=new Subject<unknown>();atualizar.mockReturnValue(sucesso);c.confirmarCancelamento();sucesso.next({});expect(dialog.open).toBe(false);
 });
});
