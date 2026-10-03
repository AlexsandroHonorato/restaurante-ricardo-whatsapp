import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CardapioSemanalComponent } from './cardapio-semanal.component';
describe('Cardápio semanal',()=>{
 it('busca sem acentos e desfaz seleção sem salvar',()=>{
  TestBed.configureTestingModule({imports:[CardapioSemanalComponent],providers:[provideHttpClient(),provideHttpClientTesting()]});
  const fixture=TestBed.createComponent(CardapioSemanalComponent);const http=TestBed.inject(HttpTestingController);fixture.detectChanges();
  http.expectOne('http://127.0.0.1:8080/api/cardapio').flush([{id:1,nome:'Pratos',produtos:[{id:4,nome:'Filé de Frango',ativo:false,dias_disponiveis:'qua,sab',variacoes:[]}]}]);
  const c=fixture.componentInstance;c.busca.set('file');expect(c.filtradas().length).toBe(1);
  const l=c.linhas()[0];c.selecionar(l,true);expect(l.dias.length).toBe(5);expect(c.pendentes()).toBe(1);
  c.desfazer(l);expect(l.dias).toEqual(['quarta','sabado']);expect(c.pendentes()).toBe(0);expect(l.produto.ativo).toBe(false);http.verify();
 });
 it('carrega dias legados e salva apenas dias sem alterar preços',()=>{
  TestBed.configureTestingModule({imports:[CardapioSemanalComponent],providers:[provideHttpClient(),provideHttpClientTesting()]});
  const fixture=TestBed.createComponent(CardapioSemanalComponent);const http=TestBed.inject(HttpTestingController);fixture.detectChanges();
  http.expectOne('http://127.0.0.1:8080/api/cardapio').flush([{id:1,nome:'Pratos',produtos:[{id:4,nome:'Feijoada',ativo:true,dias_disponiveis:'qua,sab',variacoes:[]}]}]);
  const c=fixture.componentInstance;const l=c.linhas()[0];expect(l.dias).toEqual(['quarta','sabado']);c.alternar(l,'segunda');c.salvar(l);c.salvar(l);
  const req=http.expectOne('http://127.0.0.1:8080/api/cardapio/produtos/4');expect(req.request.body).toEqual({dias_disponiveis:'segunda,quarta,sabado'});req.flush({});expect(l.mensagem).toBe('Dias salvos.');http.verify();
 });
 it('preserva seleção em falha e permite retentar',()=>{
  TestBed.configureTestingModule({imports:[CardapioSemanalComponent],providers:[provideHttpClient(),provideHttpClientTesting()]});
  const fixture=TestBed.createComponent(CardapioSemanalComponent);const http=TestBed.inject(HttpTestingController);fixture.detectChanges();
  http.expectOne('http://127.0.0.1:8080/api/cardapio').flush([{id:1,nome:'Pratos',produtos:[{id:4,nome:'Feijoada',ativo:true,dias_disponiveis:'todos',variacoes:[]}]}]);
  const c=fixture.componentInstance;const l=c.linhas()[0];c.alternar(l,'domingo');c.salvar(l);http.expectOne('http://127.0.0.1:8080/api/cardapio/produtos/4').flush({}, {status:500,statusText:'Erro'});expect(l.dias).not.toContain('domingo');expect(l.salvando).toBe(false);expect(l.erro).toBe(true);http.verify();
 });
});
