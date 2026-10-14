import type { CanalVenda, FormaPagamento, StatusPedido } from "@/db/schema";

export const NOMES_STATUS: Record<StatusPedido, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  pago: "Pago",
  separacao: "Em separação",
  enviado: "Enviado",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

export const NOMES_PAGAMENTO: Record<FormaPagamento, string> = {
  pix: "Pix",
  mercadopago: "Mercado Pago",
  whatsapp: "Combinar pelo WhatsApp",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  transferencia: "Transferência",
  marketplace: "Pago no marketplace",
  outro: "Outro",
};

export const NOMES_CANAL: Record<CanalVenda, string> = {
  site: "Site",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  loja_fisica: "Loja física",
  mercadolivre: "Mercado Livre",
  shopee: "Shopee",
  outro: "Outro",
};
