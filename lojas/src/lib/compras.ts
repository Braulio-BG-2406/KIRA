import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { compraItens, compras, lancamentos, movimentosEstoque, produtos, variantes } from "@/db/schema";
import { hojeSP } from "./datas";
import { ErroNegocio } from "./erros";

export type NovaCompra = {
  lojaId: number;
  fornecedorId: number | null;
  itens: { varianteId: number; quantidade: number; custoUnitCentavos: number }[];
  freteCentavos: number;
  vencimento: string | null;
  observacoes?: string | null;
};

export async function criarCompra(c: NovaCompra) {
  const itens = c.itens.filter((i) => i.quantidade > 0);
  if (itens.length === 0) throw new ErroNegocio("Adicione pelo menos um item.");
  for (const i of itens) {
    if (!Number.isInteger(i.quantidade) || i.custoUnitCentavos < 0) throw new ErroNegocio("Item com valor inválido.");
  }
  return db.transaction(async (tx) => {
    const ids = itens.map((i) => i.varianteId);
    const daLoja = await tx
      .select({ id: variantes.id })
      .from(variantes)
      .innerJoin(produtos, eq(produtos.id, variantes.produtoId))
      .where(and(inArray(variantes.id, ids), eq(produtos.lojaId, c.lojaId)));
    if (new Set(daLoja.map((v) => v.id)).size !== new Set(ids).size) throw new ErroNegocio("Produto de outra loja na compra.");
    const totalItens = itens.reduce((s, i) => s + i.quantidade * i.custoUnitCentavos, 0);
    const [compra] = await tx
      .insert(compras)
      .values({
        lojaId: c.lojaId,
        fornecedorId: c.fornecedorId,
        freteCentavos: Math.max(0, c.freteCentavos),
        totalCentavos: totalItens + Math.max(0, c.freteCentavos),
        vencimento: c.vencimento,
        observacoes: c.observacoes?.trim() || null,
      })
      .returning();
    await tx.insert(compraItens).values(itens.map((i) => ({ ...i, compraId: compra.id })));
    return compra;
  });
}

/**
 * Dá entrada da mercadoria: soma ao estoque, recalcula o custo médio
 * (com o frete rateado pelo valor de cada item) e lança a conta a pagar.
 */
export async function receberCompra(compraId: number, lojaId: number) {
  return db.transaction(async (tx) => {
    const [compra] = await tx
      .select()
      .from(compras)
      .where(and(eq(compras.id, compraId), eq(compras.lojaId, lojaId)))
      .for("update");
    if (!compra) throw new ErroNegocio("Compra não encontrada.");
    if (compra.status !== "rascunho") throw new ErroNegocio("Esta compra já foi recebida ou cancelada.");
    const itens = await tx.select().from(compraItens).where(eq(compraItens.compraId, compraId));
    const totalItens = itens.reduce((s, i) => s + i.quantidade * i.custoUnitCentavos, 0);

    for (const i of itens) {
      const valorItem = i.quantidade * i.custoUnitCentavos;
      const freteRateado = totalItens > 0 ? (compra.freteCentavos * valorItem) / totalItens : compra.freteCentavos / itens.length;
      const custoEfetivo = i.custoUnitCentavos + freteRateado / i.quantidade;
      const [v] = await tx.select().from(variantes).where(eq(variantes.id, i.varianteId)).for("update");
      const estoqueAntes = Math.max(0, v.estoque);
      const custoMedio =
        estoqueAntes > 0 ? (estoqueAntes * v.custoCentavos + i.quantidade * custoEfetivo) / (estoqueAntes + i.quantidade) : custoEfetivo;
      await tx
        .update(variantes)
        .set({ estoque: sql`${variantes.estoque} + ${i.quantidade}`, custoCentavos: Math.round(custoMedio) })
        .where(eq(variantes.id, i.varianteId));
      await tx.insert(movimentosEstoque).values({
        lojaId,
        varianteId: i.varianteId,
        quantidade: i.quantidade,
        tipo: "compra",
        compraId,
        nota: `Compra #${compraId}`,
      });
    }
    await tx.update(compras).set({ status: "recebida", recebidaEm: new Date() }).where(eq(compras.id, compraId));
    await tx
      .insert(lancamentos)
      .values({
        lojaId,
        tipo: "despesa",
        categoria: "Compra de mercadoria",
        descricao: `Compra #${compraId}`,
        valorCentavos: compra.totalCentavos,
        vencimento: compra.vencimento ?? hojeSP(),
        status: "pendente",
        compraId,
      })
      .onConflictDoNothing({ target: lancamentos.compraId });
  });
}

export async function cancelarCompra(compraId: number, lojaId: number) {
  const r = await db
    .update(compras)
    .set({ status: "cancelada" })
    .where(and(eq(compras.id, compraId), eq(compras.lojaId, lojaId), eq(compras.status, "rascunho")))
    .returning({ id: compras.id });
  if (r.length === 0) throw new ErroNegocio("Só dá para cancelar compra que ainda não foi recebida.");
}
