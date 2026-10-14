import { after } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { canais } from "@/db/schema";
import { urlPublica } from "@/lib/mercadopago";
import { avisoShopeeValido } from "@/lib/canais/shopee";
import { receberAvisoDePedido } from "@/lib/canais/sincronizar";

// Push da Shopee (Open Platform → App → Push Mechanism). Código 3 = mudança de status de pedido.
export async function POST(req: Request) {
  const corpo = await req.text();
  if (!avisoShopeeValido(`${urlPublica()}/api/canais/shopee/notificacoes`, corpo, req.headers.get("authorization"))) {
    return new Response("assinatura inválida", { status: 401 });
  }
  let aviso: { shop_id?: number; code?: number; data?: { ordersn?: string } } = {};
  try {
    aviso = JSON.parse(corpo);
  } catch {}
  const pedidoSn = aviso.data?.ordersn;
  if (aviso.code !== 3 || !pedidoSn || !aviso.shop_id) return new Response("");
  const [canal] = await db
    .select()
    .from(canais)
    .where(and(eq(canais.tipo, "shopee"), eq(canais.ativo, true), sql`${canais.credenciais}->>'contaId' = ${String(aviso.shop_id)}`));
  if (!canal) return new Response("");
  after(() => receberAvisoDePedido(canal, pedidoSn).catch((e) => console.error("Pedido da Shopee:", e)));
  return new Response("");
}
