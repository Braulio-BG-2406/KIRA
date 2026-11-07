import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { produtoImagens, produtos, variantes } from "@/db/schema";
import { buscarLoja } from "@/lib/lojas";

const Corpo = z.object({ itens: z.array(z.object({ varianteId: z.number().int().positive() })).max(50) });

// devolve preço e estoque atuais dos itens guardados no navegador
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const loja = await buscarLoja((await params).slug);
  if (!loja) return Response.json({ erro: "Loja não encontrada" }, { status: 404 });
  const corpo = Corpo.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return Response.json({ erro: "Pedido inválido" }, { status: 400 });
  const ids = corpo.data.itens.map((i) => i.varianteId);
  if (ids.length === 0) return Response.json({ itens: [] });
  const linhas = await db
    .select({ v: variantes, produtoNome: produtos.nome, produtoSlug: produtos.slug, produtoAtivo: produtos.ativo, produtoId: produtos.id })
    .from(variantes)
    .innerJoin(produtos, eq(produtos.id, variantes.produtoId))
    .where(and(inArray(variantes.id, ids), eq(produtos.lojaId, loja.id)));
  const imagens = linhas.length
    ? await db.select().from(produtoImagens).where(inArray(produtoImagens.produtoId, linhas.map((l) => l.produtoId))).orderBy(asc(produtoImagens.ordem), asc(produtoImagens.id))
    : [];
  return Response.json({
    itens: linhas.map((l) => ({
      varianteId: l.v.id,
      produtoNome: l.produtoNome,
      varianteNome: l.v.nome,
      produtoSlug: l.produtoSlug,
      precoCentavos: l.v.precoCentavos,
      estoque: l.v.estoque,
      disponivel: l.v.ativo && l.produtoAtivo,
      imagem: imagens.find((i) => i.produtoId === l.produtoId)?.url ?? null,
    })),
  });
}
