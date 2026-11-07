import { buscarLoja } from "@/lib/lojas";
import { opcoesDeFrete } from "@/lib/frete";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const loja = await buscarLoja((await params).slug);
  if (!loja) return Response.json({ erro: "Loja não encontrada" }, { status: 404 });
  const url = new URL(req.url);
  const subtotal = Math.max(0, parseInt(url.searchParams.get("subtotal") ?? "0", 10) || 0);
  return Response.json({ opcoes: opcoesDeFrete(loja.frete, url.searchParams.get("uf"), subtotal) });
}
