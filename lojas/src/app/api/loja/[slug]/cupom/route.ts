import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { cupons } from "@/db/schema";
import { buscarLoja } from "@/lib/lojas";
import { aplicarCupom } from "@/lib/cupom";
import { dentroDoLimite, ipDe } from "@/lib/limite";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const loja = await buscarLoja((await params).slug);
  if (!loja) return Response.json({ erro: "Loja não encontrada" }, { status: 404 });
  if (!dentroDoLimite(`cupom:${ipDe(req)}`, 20, 10 * 60_000)) {
    return Response.json({ ok: false, erro: "Muitas tentativas. Tente de novo em alguns minutos." }, { status: 429 });
  }
  const corpo = (await req.json().catch(() => ({}))) as { codigo?: unknown; subtotal?: unknown };
  const codigo = String(corpo.codigo ?? "").trim().toUpperCase().slice(0, 40);
  const subtotal = Math.max(0, Number(corpo.subtotal) || 0);
  const [cupom] = codigo ? await db.select().from(cupons).where(and(eq(cupons.lojaId, loja.id), eq(cupons.codigo, codigo))) : [];
  return Response.json(aplicarCupom(cupom, subtotal));
}
