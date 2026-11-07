import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clientes, pedidos } from "@/db/schema";
import { buscarLoja } from "@/lib/lojas";
import { criarPreferencia, linkDaPreferencia } from "@/lib/mercadopago";
import { urlDaLoja } from "@/lib/dominios";

// botão "Pagar com Mercado Pago" da página do pedido
export async function POST(_req: Request, { params }: { params: Promise<{ slug: string; codigo: string }> }) {
  const { slug, codigo } = await params;
  const loja = await buscarLoja(slug);
  if (!loja) return new Response("Loja não encontrada", { status: 404 });
  const [pedido] = await db.select().from(pedidos).where(and(eq(pedidos.lojaId, loja.id), eq(pedidos.codigo, codigo)));
  const urlPedido = `${urlDaLoja(slug)}/pedido/${codigo}`;
  if (!pedido || pedido.status !== "aguardando_pagamento" || pedido.formaPagamento !== "mercadopago") {
    return Response.redirect(urlPedido, 303);
  }
  if (pedido.mpPreferenciaId) return Response.redirect(linkDaPreferencia(pedido.mpPreferenciaId), 303);
  const [cliente] = pedido.clienteId ? await db.select().from(clientes).where(eq(clientes.id, pedido.clienteId)) : [];
  try {
    const pref = await criarPreferencia({ loja, pedido, cliente: { nome: cliente?.nome ?? "Cliente", email: cliente?.email }, urlPedido });
    await db.update(pedidos).set({ mpPreferenciaId: pref.id }).where(eq(pedidos.id, pedido.id));
    return Response.redirect(pref.link, 303);
  } catch (e) {
    console.error("Mercado Pago:", e);
    return Response.redirect(`${urlPedido}?erro=pagamento`, 303);
  }
}
