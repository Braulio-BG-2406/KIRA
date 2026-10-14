import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { produtos, variantes } from "@/db/schema";
import type { OpcaoVariante } from "@/components/admin/EscolherProduto";

/** todas as variações da loja, para os formulários de venda e de compra */
export async function opcoesDeVariantes(lojaId: number, incluirInativos = false): Promise<OpcaoVariante[]> {
  const filtros = [eq(produtos.lojaId, lojaId)];
  if (!incluirInativos) filtros.push(eq(variantes.ativo, true));
  const linhas = await db
    .select({ v: variantes, produto: produtos.nome })
    .from(variantes)
    .innerJoin(produtos, eq(produtos.id, variantes.produtoId))
    .where(and(...filtros))
    .orderBy(asc(produtos.nome), asc(variantes.ordem));
  return linhas.map(({ v, produto }) => ({
    id: v.id,
    nome: v.nome === "Padrão" ? produto : `${produto} · ${v.nome}`,
    sku: v.sku,
    precoCentavos: v.precoCentavos,
    custoCentavos: v.custoCentavos,
    estoque: v.estoque,
  }));
}
