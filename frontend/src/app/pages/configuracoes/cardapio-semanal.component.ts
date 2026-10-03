import { Component, OnInit, inject, signal } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { CategoriaCardapio, ProdutoCardapio } from '../../core/models/dashboard.model';
import { DIAS_CARDAPIO, lerDiasCardapio, gravarDiasCardapio } from '../../core/models/dias-cardapio';
interface Linha {produto: ProdutoCardapio; categoria: string; dias: string[]; original: string; salvando: boolean; mensagem: string; erro: boolean;}
@Component({selector:'app-cardapio-semanal',standalone:true,template:`
 <section class="glass-card"><h2>Pratos por dia da semana</h2><p>Marque os dias em que cada item do cardápio é oferecido. Produtos pausados continuam pausados.</p>
 @if(erro()){<p role="alert">{{erro()}} <button class="btn btn-secondary" (click)="carregar()">Tentar novamente</button>}
 @if(carregando()){<p role="status">Carregando cardápio…</p>}
 <div class="scroll"><table><thead><tr><th>Prato / produto</th>@for(d of semana;track d.valor){<th>{{d.nome}}</th>}<th>Ação</th></tr></thead><tbody>
 @for(l of linhas();track l.produto.id){<tr><th>{{l.produto.nome}}<small>{{l.categoria}} · {{l.produto.ativo ? 'Ativo' : 'Pausado'}}</small></th>
 @for(d of semana;track d.valor){<td><input type="checkbox" [attr.aria-label]="l.produto.nome + ' — ' + d.nome" [checked]="l.dias.includes(d.valor)" (change)="alternar(l,d.valor)" [disabled]="l.salvando" /></td>}
 <td><button class="btn btn-primary btn-sm" [disabled]="l.salvando || !l.dias.length || assinatura(l)===l.original" (click)="salvar(l)">{{l.salvando?'Salvando…':'Salvar'}}</button>
 @if(!l.dias.length){<small role="alert">Selecione um dia.</small>} @if(l.mensagem){<small [attr.role]="l.erro?'alert':'status'">{{l.mensagem}}</small>}</td></tr>}
 @empty { @if(!carregando() && !erro()){<tr><td colspan="9">Nenhum produto cadastrado. Cadastre os pratos no menu Cardápio.</td></tr>} }
 </tbody></table></div></section>
 `,styles:[`section{padding:24px;margin-top:24px}p,small{color:var(--text-muted);font-size:.8rem}p{margin:8px 0 20px}.scroll{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:.8rem}th,td{padding:12px 8px;border-bottom:1px solid var(--border-color)}th:first-child{text-align:left;min-width:210px}td{text-align:center}small{display:block;margin-top:6px}input{width:18px;height:18px;accent-color:var(--primary)}input:focus-visible{outline:2px solid var(--primary);outline-offset:3px}`]})
export class CardapioSemanalComponent implements OnInit {
 private api=inject(ApiService);semana=DIAS_CARDAPIO;linhas=signal<Linha[]>([]);erro=signal<string|null>(null);carregando=signal(false);
 ngOnInit(){this.carregar();}
 carregar(){this.carregando.set(true);this.erro.set(null);this.api.getCardapioConfiguracao().subscribe({next:cats=>{this.linhas.set(cats.flatMap(c=>c.produtos.map(produto=>({produto,categoria:c.nome,dias:lerDiasCardapio(produto.dias_disponiveis),original:gravarDiasCardapio(lerDiasCardapio(produto.dias_disponiveis)),salvando:false,mensagem:'',erro:false}))));this.carregando.set(false);},error:()=>{this.carregando.set(false);this.erro.set('Não foi possível carregar os pratos.');}});}
 assinatura(l:Linha){return gravarDiasCardapio(l.dias);}
 alternar(l:Linha,d:string){l.dias=l.dias.includes(d)?l.dias.filter(x=>x!==d):[...l.dias,d];l.mensagem='';}
 salvar(l:Linha){if(l.salvando || !l.dias.length || this.assinatura(l)===l.original)return;l.salvando=true;l.mensagem='';const valor=this.assinatura(l);this.api.atualizarProduto(l.produto.id,{dias_disponiveis:valor}).subscribe({next:()=>{l.original=valor;l.salvando=false;l.erro=false;l.mensagem='Dias salvos.';},error:()=>{l.salvando=false;l.erro=true;l.mensagem='Não foi possível salvar. Tente novamente.';}});}
}
