import { buscarLoja } from "@/lib/lojas";
import { gerarFeed } from "@/lib/feed";

// lido pelo Google Merchant Center e pelo catálogo da Meta (Instagram/Facebook)
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const loja = await buscarLoja((await params).slug);
  if (!loja) return new Response("Loja não encontrada", { status: 404 });
  return new Response(await gerarFeed(loja), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=900" },
  });
}
