import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DashboardAnalisesComponent } from './dashboard-analises.component';
const url='http://127.0.0.1:8080/api/dashboard/analises?dias=';
const dados={dias:7,fuso:'America/Sao_Paulo',pedidos_fora_agenda:0,demanda:[{dia:1,horas:[{hora:11,pedidos:2,atendimento:true}]}],tempos:[],atendimentos:{total:0,conversao:null,status:[],abandonos:[]},cancelamentos:[]};
describe('Atualização estável do mapa semanal',()=>{
 beforeEach(()=>TestBed.configureTestingModule({imports:[DashboardAnalisesComponent],providers:[provideHttpClient(),provideHttpClientTesting()]}));
 it('mantém a mesma grade durante atualização automática e falha',()=>{
  const f=TestBed.createComponent(DashboardAnalisesComponent);const http=TestBed.inject(HttpTestingController);f.componentRef.setInput('dias',7);f.detectChanges();http.expectOne(url+'7').flush(dados);f.detectChanges();
  const grade=f.nativeElement.querySelector('.demanda');f.componentRef.setInput('atualizacao',1);f.detectChanges();expect(f.nativeElement.querySelector('.demanda')).toBe(grade);expect(f.nativeElement.textContent).not.toContain('Carregando indicadores');expect(grade.getAttribute('aria-busy')).toBe('true');
  http.expectOne(url+'7').flush({}, {status:503,statusText:'Erro'});f.detectChanges();expect(f.nativeElement.querySelector('.demanda')).toBe(grade);expect(f.nativeElement.textContent).toContain('Exibindo a última atualização.');expect(grade.getAttribute('aria-busy')).toBe('false');http.verify();
 });
 it('só troca o período exibido ao receber os novos dados',()=>{
  const f=TestBed.createComponent(DashboardAnalisesComponent);const http=TestBed.inject(HttpTestingController);f.componentRef.setInput('dias',7);f.detectChanges();http.expectOne(url+'7').flush(dados);f.detectChanges();const grade=f.nativeElement.querySelector('.demanda');
  f.componentRef.setInput('dias',30);f.detectChanges();expect(grade.textContent).toContain('Últimos 7 dias');http.expectOne(url+'30').flush({...dados,dias:30});f.detectChanges();expect(f.nativeElement.querySelector('.demanda')).toBe(grade);expect(grade.textContent).toContain('Últimos 30 dias');http.verify();
 });
});
