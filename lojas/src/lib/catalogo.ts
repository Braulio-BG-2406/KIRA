import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNotNull, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { categorias, produtoImagens, produtos, variantes, type Produto, type Variante } from "@/db/schema";

export type ProdutoVitrine = Produto & {
  variantes: Variante[];
  imagens: string[];
  precoMin: number;
  precoMax: number;
  precoDe: number | null;
  estoqueTotal: number;
};

async function completar(lista: Produto[]): Promise<ProdutoVitrine[]> {
  if (lista.length === 0) return [];
  const ids = lista.map((p) => p.id);
  const [vs, imgs] = await Promise.all([
    db.select().from(variantes).where(and(inArray(variantes.produtoId, ids), eq(variantes.ativo, true))).orderBy(asc(variantes.ordem), asc(variantes.id)),
    db.select().from(produtoImagens).where(inArray(produtoImagens.produtoId, ids)).orderBy(asc(produtoImagens.ordem), asc(produtoImagens.id)),
  ]);
  return lista
    .map((p) => {
      const pv = vs.filter((v) => v.produtoId === p.id);
      const precos = pv.map((v) => v.precoCentavos);
      const de = pv.map((v) => v.precoDeCentavos).filter((x): x is number => x != null && x > Math.min(...precos));
      return {
        ...p,
        variantes: pv,
        imagens: imgs.filter((i) => i.produtoId === p.id).map((i) => i.url),
        precoMin: Math.min(...precos),
        precoMax: Math.max(...precos),
        precoDe: de.length ? Math.max(...de) : null,
        estoqueTotal: pv.reduce((s, v) => s + Math.max(0, v.estoque), 0),
      };
    })
    .filter((p) => p.variantes.length > 0);
}

export async function listarVitrine(p: { lojaId: number; categoriaId?: number; busca?: string; destaque?: boolean; marca?: string; limite?: number }) {
  const filtros: SQL[] = [eq(produtos.lojaId, p.lojaId), eq(produtos.ativo, true)];
  if (p.categoriaId) filtros.push(eq(produtos.categoriaId, p.categoriaId));
  if (p.destaque) filtros.push(eq(produtos.destaque, true));
  if (p.marca) filtros.push(eq(produtos.marca, p.marca));
  if (p.busca?.trim()) {
    const termo = `%${p.busca.trim().replace(/[%_\\]/g, "\\$&")}%`;
    filtros.push(or(ilike(produtos.nome, termo), ilike(produtos.descricao, termo), ilike(produtos.marca, termo))!);
  }
  const lista = await db
    .select()
    .from(produtos)
    .where(and(...filtros))
    .orderBy(desc(produtos.destaque), desc(produtos.criadoEm))
    .limit(p.limite ?? 60);
  const completos = await completar(lista);
  // esgotados vão para o fim
  return completos.sort((a, b) => Number(b.estoqueTotal > 0) - Number(a.estoqueTotal > 0));
}

export async function produtoPorSlug(lojaId: number, slug: string) {
  const [p] = await db
    .select()
    .from(produtos)
    .where(and(eq(produtos.lojaId, lojaId), eq(produtos.slug, slug), eq(produtos.ativo, true)));
  if (!p) return null;
  return (await completar([p]))[0] ?? null;
}

export async function categoriasDaLoja(lojaId: number) {
  return db.select().from(categorias).where(eq(categorias.lojaId, lojaId)).orderBy(asc(categorias.ordem), asc(categorias.nome));
}

/** marcas que aparecem nos produtos à venda (para o filtro da vitrine) */
export async function marcasDaLoja(lojaId: number, categoriaId?: number) {
  const filtros = [eq(produtos.lojaId, lojaId), eq(produtos.ativo, true), isNotNull(produtos.marca)];
  if (categoriaId) filtros.push(eq(produtos.categoriaId, categoriaId));
  const linhas = await db.selectDistinct({ marca: produtos.marca }).from(produtos).where(and(...filtros)).orderBy(asc(produtos.marca));
  return linhas.map((l) => l.marca!).filter(Boolean);
}

/** todas as marcas já usadas na loja (sugestões no cadastro) */
export async function todasAsMarcas(lojaId: number) {
  const linhas = await db.selectDistinct({ marca: produtos.marca }).from(produtos).where(and(eq(produtos.lojaId, lojaId), isNotNull(produtos.marca))).orderBy(asc(produtos.marca));
  return linhas.map((l) => l.marca!).filter(Boolean);
}
