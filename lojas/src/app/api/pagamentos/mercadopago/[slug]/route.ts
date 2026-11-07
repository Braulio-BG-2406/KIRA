import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pedidoHistorico, pedidos } from "@/db/schema";
import { buscarLoja } from "@/lib/lojas";
import { consultarPagamento } from "@/lib/mercadopago";
import { marcarComoPago } from "@/lib/pedidos";

// Aviso do Mercado Pago. Nada do corpo é confiado: o pagamento é consultado na API do MP.
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const loja = await buscarLoja((await params).slug);
  if (!loja) return new Response("ok");
  const url = new URL(req.url);
  const corpo = (await req.json().catch(() => ({}))) as { type?: string; topic?: string; data?: { id?: string | number } };
  const tipo = corpo.type ?? corpo.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const id = String(corpo.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");
  if (tipo !== "payment" || !id) return new Response("ok");

  const pagamento = await consultarPagamento(loja.slug, id);
  if (!pagamento || pagamento.status !== "approved") return new Response("ok");
  const pedidoId = Number(pagamento.external_reference);
  if (!Number.isInteger(pedidoId)) return new Response("ok");
  const [pedido] = await db.select().from(pedidos).where(eq(pedidos.id, pedidoId));
  if (!pedido || pedido.lojaId !== loja.id) return new Response("ok");

  if (Math.round(pagamento.transaction_amount * 100) < pedido.totalCentavos) {
    await db.insert(pedidoHistorico).values({
      pedidoId,
      status: pedido.status,
      nota: `Mercado Pago aprovou R$ ${pagamento.transaction_amount.toFixed(2)}, menos que o total do pedido. Confira antes de enviar.`,
    });
    return new Response("ok");
  }
  await marcarComoPago(pedidoId, { mpPagamentoId: String(pagamento.id), nota: "Pagamento aprovado no Mercado Pago" });
  return new Response("ok");
}
