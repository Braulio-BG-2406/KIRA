import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { movimentosEstoque, produtos, variantes } from "@/db/schema";
import { ErroNegocio } from "./erros";

/** entrada, saída ou contagem (define o estoque para um valor exato) */
export async function ajustarEstoque(p: {
  lojaId: number;
  varianteId: number;
  modo: "entrada" | "saida" | "contagem";
  quantidade: number;
  nota?: string | null;
}) {
  if (!Number.isInteger(p.quantidade) || p.quantidade < 0) throw new ErroNegocio("Quantidade inválida.");
  return db.transaction(async (tx) => {
    const [linha] = await tx
      .select({ v: variantes, lojaId: produtos.lojaId })
      .from(variantes)
      .innerJoin(produtos, eq(produtos.id, variantes.produtoId))
      .where(eq(variantes.id, p.varianteId))
      .for("update", { of: variantes });
    if (!linha || linha.lojaId !== p.lojaId) throw new ErroNegocio("Produto não encontrado.");
    const atual = linha.v.estoque;
    const delta = p.modo === "entrada" ? p.quantidade : p.modo === "saida" ? -p.quantidade : p.quantidade - atual;
    if (atual + delta < 0) throw new ErroNegocio(`Só há ${atual} unidade(s) em estoque.`);
    if (delta === 0) return atual;
    await tx
      .update(variantes)
      .set({ estoque: sql`${variantes.estoque} + ${delta}` })
      .where(eq(variantes.id, p.varianteId));
    await tx.insert(movimentosEstoque).values({
      lojaId: p.lojaId,
      varianteId: p.varianteId,
      quantidade: delta,
      tipo: p.modo === "contagem" ? "ajuste" : p.modo,
      nota: p.nota?.trim() || (p.modo === "contagem" ? `Contagem: ${atual} → ${p.quantidade}` : null),
    });
    return atual + delta;
  });
}

export async function registrarEstoqueInicial(lojaId: number, varianteId: number, quantidade: number) {
  if (quantidade <= 0) return;
  await db.insert(movimentosEstoque).values({ lojaId, varianteId, quantidade, tipo: "entrada", nota: "Estoque inicial" });
}
