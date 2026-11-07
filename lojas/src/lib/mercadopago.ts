import "server-only";
import type { Loja, Pedido } from "@/db/schema";

// Checkout Pro do Mercado Pago: o cliente paga (Pix, cartão, boleto) na página do MP
// e o MP avisa o nosso webhook. O webhook sempre confere o pagamento na API do MP,
// então um aviso falso não marca pedido como pago.

const API = "https://api.mercadopago.com";

export function tokenMercadoPago(slug: string): string | null {
  return process.env[`MERCADOPAGO_TOKEN_${slug.toUpperCase().replace(/-/g, "_")}`] || null;
}

export function urlPublica(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function criarPreferencia(p: {
  loja: Loja;
  pedido: Pedido;
  cliente: { nome: string; email?: string | null };
  urlPedido: string;
}): Promise<{ id: string; link: string }> {
  const token = tokenMercadoPago(p.loja.slug);
  if (!token) throw new Error("Mercado Pago não configurado para esta loja.");
  // um item só com o total do pedido (já com frete e desconto): o valor cobrado bate sempre
  const corpo: Record<string, unknown> = {
    items: [
      {
        id: String(p.pedido.id),
        title: `${p.loja.nome} - pedido #${p.pedido.numero}`.slice(0, 250),
        quantity: 1,
        unit_price: p.pedido.totalCentavos / 100,
        currency_id: "BRL",
      },
    ],
    external_reference: String(p.pedido.id),
    statement_descriptor: p.loja.nome.replace(/[^\w ]/g, "").slice(0, 22),
    back_urls: { success: p.urlPedido, pending: p.urlPedido, failure: p.urlPedido },
    notification_url: `${urlPublica()}/api/pagamentos/mercadopago/${p.loja.slug}`,
    payer: { name: p.cliente.nome, ...(p.cliente.email ? { email: p.cliente.email } : {}) },
  };
  // o MP só aceita voltar sozinho para endereço https
  if (urlPublica().startsWith("https://")) corpo.auto_return = "approved";

  const r = await fetch(`${API}/checkout/preferences`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  if (!r.ok) throw new Error(`Mercado Pago recusou a preferência (${r.status}): ${(await r.text()).slice(0, 300)}`);
  const dados = (await r.json()) as { id: string; init_point: string };
  return { id: dados.id, link: dados.init_point };
}

export type PagamentoMP = { id: number; status: string; external_reference: string | null; transaction_amount: number };

export async function consultarPagamento(slug: string, id: string): Promise<PagamentoMP | null> {
  const token = tokenMercadoPago(slug);
  if (!token || !/^\d+$/.test(id)) return null;
  const r = await fetch(`${API}/v1/payments/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  return (await r.json()) as PagamentoMP;
}

export function linkDaPreferencia(id: string): string {
  return `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=${encodeURIComponent(id)}`;
}
