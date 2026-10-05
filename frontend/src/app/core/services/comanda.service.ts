import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { concatMap, filter, finalize, from, map, mergeMap } from 'rxjs';
import { API_BASE } from './session-state';
import { Pedido } from '../models/dashboard.model';

const LARGURA = 32; // cabe em bobina de 58 mm e de 80 mm
const PREFERENCIA = 'botclient.comandaAutomatica';
const reais = (v: number | string | undefined) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const separador = '-'.repeat(LARGURA);

/** Texto à esquerda e valor alinhado à direita; se não couber, o valor desce para a linha de baixo. */
function linha(esquerda: string, direita: string) {
  return esquerda.length + direita.length + 1 <= LARGURA
    ? esquerda + direita.padStart(LARGURA - esquerda.length)
    : `${esquerda}\n${direita.padStart(LARGURA)}`;
}

/** Comanda em texto puro para impressora térmica. */
export function formatarComanda(p: Pedido): string {
  const e = p.endereco;
  const quando = new Date(p.created_at).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const itens = (p.itens || []).flatMap((i) => [
    linha(`${i.quantidade}x ${i.nome_snapshot} (${i.tamanho_snapshot})`, reais(i.subtotal)),
    ...(i.adicionais || []).map((a) => `   + ${a.quantidade}x ${a.nome_snapshot}`),
    ...(i.observacao ? [`   obs: ${i.observacao}`] : []),
  ]);
  return [
    `COMANDA ${p.codigo_pedido}`,
    quando,
    separador,
    `Cliente: ${p.cliente?.nome || 'Cliente WhatsApp'}`,
    `Tel: ${p.cliente?.telefone || '-'}`,
    e ? `Entrega: ${e.logradouro}, ${e.numero} - ${e.bairro}` : 'Retirada no balcão',
    ...(e?.complemento ? [`Compl.: ${e.complemento}`] : []),
    ...(e?.ponto_referencia ? [`Ref.: ${e.ponto_referencia}`] : []),
    separador,
    ...itens,
    separador,
    linha('Subtotal', reais(p.valor_subtotal)),
    ...(Number(p.taxa_entrega) ? [linha('Entrega', reais(p.taxa_entrega))] : []),
    ...(Number(p.valor_desconto) ? [linha('Desconto', `-${reais(p.valor_desconto)}`)] : []),
    linha('TOTAL', reais(p.valor_total)),
    `Pagamento: ${p.forma_pagamento.replace(/_/g, ' ').toUpperCase()}`,
    ...(p.troco_para ? [`Troco para ${reais(p.troco_para)}`] : []),
    ...(p.observacoes ? [separador, `OBS: ${p.observacoes}`] : []),
    separador,
  ].join('\n');
}

/**
 * Impressão da comanda pelo navegador do computador da cozinha (impressora térmica instalada no
 * sistema). No Chrome aberto com --kiosk-printing a impressão sai direto, sem a janela de confirmação.
 */
@Injectable({ providedIn: 'root' })
export class ComandaService {
  private http = inject(HttpClient);
  private buscando = false;

  get automatica(): boolean {
    try {
      return localStorage.getItem(PREFERENCIA) === '1';
    } catch {
      return false;
    }
  }

  set automatica(ligada: boolean) {
    try {
      localStorage.setItem(PREFERENCIA, ligada ? '1' : '0');
    } catch {
      // sem armazenamento local a preferência vale só até recarregar a página
    }
  }

  /** Impressão manual: sempre imprime (reimpressão permitida) e registra no servidor. */
  imprimir(pedido: Pedido) {
    this.enviarParaImpressora(formatarComanda(pedido));
    this.registrar(pedido.id).subscribe({ error: () => {} });
  }

  /** Impressão automática: imprime, do mais antigo ao mais novo, só os pedidos que este aparelho marcou primeiro. */
  imprimirPendentes() {
    if (this.buscando) return;
    this.buscando = true;
    this.http
      .get<{ data: Pedido[] }>(`${API_BASE}/pedidos?sem_comanda=1&per_page=20`)
      .pipe(
        mergeMap((r) => from([...r.data].reverse())),
        concatMap((p) =>
          this.registrar(p.id).pipe(
            filter((r) => r.primeira),
            map(() => p),
          ),
        ),
        finalize(() => (this.buscando = false)),
      )
      .subscribe({ next: (p) => this.enviarParaImpressora(formatarComanda(p)), error: () => {} });
  }

  private registrar(id: number) {
    return this.http.post<{ primeira: boolean }>(`${API_BASE}/pedidos/${id}/comanda`, {});
  }

  /** Imprime por um iframe oculto; o texto entra como textContent (nunca como HTML). */
  protected enviarParaImpressora(texto: string) {
    const quadro = document.createElement('iframe');
    quadro.setAttribute('aria-hidden', 'true');
    quadro.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(quadro);
    const doc = quadro.contentDocument!;
    const estilo = doc.createElement('style');
    estilo.textContent =
      '@page{size:auto;margin:2mm}body{margin:0}pre{margin:0;font:13px/1.25 "Courier New",monospace;white-space:pre-wrap;color:#000}';
    const pre = doc.createElement('pre');
    pre.textContent = texto;
    doc.head.appendChild(estilo);
    doc.body.appendChild(pre);
    quadro.contentWindow!.focus();
    quadro.contentWindow!.print();
    setTimeout(() => quadro.remove(), 1000);
  }
}
