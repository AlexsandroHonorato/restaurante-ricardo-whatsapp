export interface DashboardKpis {
  faturamento_total: number;
  faturamento_hoje: number;
  total_pedidos: number;
  pedidos_hoje: number;
  ticket_medio: number;
  total_clientes: number;
  pedidos_por_status: {
    confirmado?: number;
    pendente: number;
    em_preparo: number;
    saiu_para_entrega: number;
    entregue: number;
    cancelado: number;
  };
  taxa_conversao_ia: number;
  total_transbordo_humano: number;
  taxa_transbordo: number;
  tempo_medio_atendimento_min: number;
}

export interface VendaGrafico {
  ticket_medio?: number | null;
  data: string;
  total_pedidos: number;
  faturamento: number;
}

export interface TopProduto {
  produto: string;
  tamanho: string;
  total_quantidade: number;
  total_faturado: number;
}

export interface MapaBairro {
  bairro: string;
  total_pedidos: number;
  total_faturamento: number;
}

export interface FormaPagamentoStat {
  forma_pagamento: string;
  quantidade: number;
  faturamento: number;
}

export interface Cliente {
  id: number;
  telefone: string;
  nome: string;
  primeiro_contato_em: string;
  ultimo_contato_em: string;
  total_pedidos: number;
  total_gasto: number;
  ativo: boolean;
  enderecos?: Endereco[];
}

export interface Endereco {
  id: number;
  cliente_id: number;
  logradouro: string;
  numero: string;
  bairro: string;
  complemento?: string;
  ponto_referencia?: string;
  cep?: string;
  cidade: string;
  estado: string;
}

export interface PedidoItem {
  id: number;
  pedido_id: number;
  nome_snapshot: string;
  tamanho_snapshot: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  observacao?: string;
  adicionais?: {
    id: number;
    nome_snapshot: string;
    quantidade: number;
    preco_unitario: number;
    subtotal: number;
  }[];
}

export interface Pedido {
  id: number;
  codigo_pedido: string;
  cliente_id: number;
  endereco_id?: number;
  status: 'pendente' | 'confirmado' | 'em_preparo' | 'saiu_para_entrega' | 'entregue' | 'cancelado';
  forma_pagamento: 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito' | 'outro';
  valor_subtotal: number;
  taxa_entrega: number;
  valor_desconto: number;
  valor_total: number;
  troco_para?: number;
  valor_troco?: number;
  tempo_estimado_min: number;
  observacoes?: string;
  origem: string;
  created_at: string;
  cliente?: Cliente;
  endereco?: Endereco;
  itens?: PedidoItem[];
}

export interface CategoriaCardapio {
  id: number;
  nome: string;
  slug: string;
  descricao?: string;
  ordem_exibicao: number;
  ativo: boolean;
  produtos: ProdutoCardapio[];
}

export interface ProdutoCardapio {
  id: number;
  categoria_id: number;
  tipo: string;
  nome: string;
  descricao?: string;
  dias_disponiveis: string;
  ativo: boolean;
  variacoes: {
    id: number;
    tamanho: string;
    preco: number;
  }[];
}

export interface Atendimento {
  id: number;
  cliente_id: number;
  pedido_id?: number;
  inicio_em: string;
  fim_em?: string;
  duracao_segundos?: number;
  status: string;
  total_mensagens_cliente: number;
  total_mensagens_bot: number;
  transbordo_humano: boolean;
  motivo_transbordo?: string;
  canal: string;
  cliente?: Cliente;
  pedido?: Pedido;
}

export interface HorarioAtendimento {
  id: number;
  dia_semana: number;
  nome_dia: string;
  ativo: boolean;
  hora_inicio: string | null;
  hora_fim: string | null;
}

export interface HorariosAtendimentoResponse {
  fuso: string;
  horarios: HorarioAtendimento[];
}

export interface AnalisesDashboard {
 dias: number; fuso: string; pedidos_fora_agenda: number;
 demanda: {dia: number; horas: {hora: number; pedidos: number; atendimento: boolean}[]}[];
 tempos: {tipo: string; minutos: number | null; amostras: number}[];
 atendimentos: {total: number; conversao: number | null; status: ContagemAnalise[]; abandonos: ContagemAnalise[]};
 cancelamentos: ContagemAnalise[];
}
export interface ContagemAnalise {nome: string; total: number;}
