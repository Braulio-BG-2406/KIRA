import { after } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { canais } from "@/db/schema";
import { receberAvisoDePedido } from "@/lib/canais/sincronizar";

// Avisos do Mercado Livre (configure esta URL no app do DevCenter, tópico "orders_v2").
// Nada do corpo é confiado: o pedido é buscado de novo na API do ML.
export async function POST(req: Request) {
  const aviso = (await req.json().catch(() => ({}))) as { resource?: string; user_id?: number | string; topic?: string };
  const id = aviso.resource?.match(/^\/orders\/(\d+)$/)?.[1];
  if (!id || !aviso.user_id || !String(aviso.topic).startsWith("orders")) return new Response("ok");
  const [canal] = await db
    .select()
    .from(canais)
    .where(and(eq(canais.tipo, "mercadolivre"), eq(canais.ativo, true), sql`${canais.credenciais}->>'contaId' = ${String(aviso.user_id)}`));
  if (!canal) return new Response("ok");
  // o ML quer resposta rápida; o pedido é registrado logo depois
  after(() => receberAvisoDePedido(canal, id).catch((e) => console.error("Pedido do Mercado Livre:", e)));
  return new Response("ok");
}
