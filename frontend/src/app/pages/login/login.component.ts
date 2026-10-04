import { Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
@Component({selector:'app-login',standalone:true,imports:[FormsModule],template:`
<main class="login-page"><section class="brand-panel"><div class="brand-mark">FR</div><p class="eyebrow">RESTAURANTE FAMÍLIA RICARDO</p><h1>Seu restaurante,<br>em boas mãos.</h1><p>Pedidos, atendimentos e gestão em um só lugar.</p><small>Acesso exclusivo da equipe</small></section>
<section class="login-card"><span class="eyebrow">BEM-VINDO DE VOLTA</span><h2>Entrar no sistema</h2><p>Informe seus dados para acessar o painel.</p>
<form #form="ngForm" (ngSubmit)="entrar(form)" novalidate>
<label for="email">E-mail</label><input id="email" name="email" type="email" [(ngModel)]="email" #e="ngModel" required email maxlength="254" autocomplete="username" placeholder="seu@email.com" [disabled]="carregando()">
@if((e.touched||form.submitted)&&e.invalid){<small class="error">Informe um e-mail válido.</small>}
<label for="password">Senha</label><div class="password-wrap"><input id="password" name="password" [type]="mostrar()?'text':'password'" [(ngModel)]="senha" #p="ngModel" required maxlength="128" autocomplete="current-password" [disabled]="carregando()"><button type="button" (click)="mostrar.set(!mostrar())" [attr.aria-pressed]="mostrar()">{{mostrar()?'Ocultar':'Mostrar'}}</button></div>
@if((p.touched||form.submitted)&&p.invalid){<small class="error">Informe sua senha.</small>}
@if(erro()){<p class="error" role="alert">{{erro()}}</p>}
<button class="btn btn-primary submit" type="submit" [disabled]="carregando()" [attr.aria-busy]="carregando()">{{carregando()?'Entrando…':'Entrar'}} <span aria-hidden="true">→</span></button>
</form><p class="help">Precisa de acesso? Solicite seu cadastro ao administrador.</p></section></main>
`,styleUrl:'./login.component.css'})
export class LoginComponent {
auth=inject(AuthService);private router=inject(Router);email='';senha='';mostrar=signal(false);carregando=signal(false);erro=signal('');
entrar(form:NgForm){if(form.invalid||this.carregando())return;this.carregando.set(true);this.erro.set('');
this.auth.login(this.email.trim().toLowerCase(),this.senha).subscribe({next:()=>{this.senha='';this.carregando.set(false);void this.router.navigateByUrl('/dashboard');},error:e=>{this.carregando.set(false);this.erro.set(e.status===429?'Muitas tentativas. Aguarde um minuto e tente novamente.':e.status===422?'E-mail ou senha inválidos.':'Não foi possível entrar. Verifique a conexão e tente novamente.');}});}
}
