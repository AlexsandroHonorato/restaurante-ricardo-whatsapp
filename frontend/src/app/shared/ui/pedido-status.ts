export const STATUS_PEDIDO: Record<string, {nome: string; classe: string; icone: string}> = {
 pendente: {nome:'Aguardando confirmação',classe:'badge-pending',icone:'◷'},
 confirmado: {nome:'Confirmado',classe:'badge-confirmed',icone:'✓'},
 em_preparo: {nome:'Em preparação',classe:'badge-prep',icone:'◴'},
 saiu_para_entrega: {nome:'Saiu para entrega',classe:'badge-delivery',icone:'➜'},
 entregue: {nome:'Entregue',classe:'badge-delivered',icone:'✓'},
 cancelado: {nome:'Cancelado',classe:'badge-canceled',icone:'×'}
};
