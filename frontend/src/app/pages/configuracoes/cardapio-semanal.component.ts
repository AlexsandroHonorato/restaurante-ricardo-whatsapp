import { Component, OnInit, inject, signal } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { ProdutoCardapio } from '../../core/models/dashboard.model';
import { DIAS_CARDAPIO, lerDiasCardapio, gravarDiasCardapio } from '../../core/models/dias-cardapio';
interface Linha {produto: ProdutoCardapio; categoria: string; dias: string[]; original: string; salvando: boolean; mensagem: string; erro: boolean;}
@Component({selector:'app-cardapio-semanal',standalone:true,templateUrl:'./cardapio-semanal.component.html',styleUrl:'./cardapio-semanal.component.css'})
export class CardapioSemanalComponent implements OnInit {
 private api=inject(ApiService);semana=DIAS_CARDAPIO;linhas=signal<Linha[]>([]);erro=signal<string|null>(null);carregando=signal(false);
 busca = signal(''); categoria = signal('');
 iconeCategoria(categoria:string){
  const nome=categoria.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(nome.includes('cerveja'))return 'M7 7h9v13H7z M16 9h3v8h-3 M7 4v3 M11 3v4';
  if(nome.includes('bebida'))return 'M8 3h8l-1 18H9z M8 7h8 M13 3l3-2';
  if(nome.includes('adicion'))return 'M12 5v14 M5 12h14';
  if(nome.includes('porc'))return 'M3 10h18 M5 10l2 10h10l2-10 M8 3v5 M12 3v5 M16 3v5';
  if(nome.includes('dia') && !nome.includes('diario'))return 'M5 5h14v15H5z M8 3v4 M16 3v4 M5 10h14 M9 14l2 2 4-4';
  return 'M4 3v6 M7 3v6 M10 3v6 M4 7h6 M7 9v12 M17 3v18 M17 3c4 3 4 8 0 9';
 }
 categorias(){return [...new Set(this.linhas().map(l=>l.categoria))];}
 filtradas(){const busca=this.busca().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();return this.linhas().filter(l=>(!this.categoria() || l.categoria===this.categoria()) && l.produto.nome.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(busca));}
 pendentes(){return this.linhas().filter(l=>this.assinatura(l)!==l.original).length;}
 selecionar(l:Linha,uteis=false){if(l.salvando)return;l.dias=this.semana.slice(0,uteis?5:7).map(d=>d.valor);l.mensagem='';}
 desfazer(l:Linha){if(l.salvando)return;l.dias=lerDiasCardapio(l.original);l.mensagem='';l.erro=false;}
 ngOnInit(){this.carregar();}
 carregar(){this.carregando.set(true);this.erro.set(null);this.api.getCardapioConfiguracao().subscribe({next:cats=>{this.linhas.set(cats.flatMap(c=>c.produtos.map(produto=>({produto,categoria:c.nome,dias:lerDiasCardapio(produto.dias_disponiveis),original:gravarDiasCardapio(lerDiasCardapio(produto.dias_disponiveis)),salvando:false,mensagem:'',erro:false}))));this.carregando.set(false);},error:()=>{this.carregando.set(false);this.erro.set('Não foi possível carregar os pratos.');}});}
 assinatura(l:Linha){return gravarDiasCardapio(l.dias);}
 alternar(l:Linha,d:string){l.dias=l.dias.includes(d)?l.dias.filter(x=>x!==d):[...l.dias,d];l.mensagem='';}
 salvar(l:Linha){if(l.salvando || !l.dias.length || this.assinatura(l)===l.original)return;l.salvando=true;l.mensagem='';const valor=this.assinatura(l);this.api.atualizarProduto(l.produto.id,{dias_disponiveis:valor}).subscribe({next:()=>{l.original=valor;l.salvando=false;l.erro=false;l.mensagem='Dias salvos.';},error:()=>{l.salvando=false;l.erro=true;l.mensagem='Não foi possível salvar. Tente novamente.';}});}
}
