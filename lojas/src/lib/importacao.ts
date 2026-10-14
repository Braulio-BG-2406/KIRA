import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { categorias, movimentosEstoque, produtos, variantes } from "@/db/schema";
import { csvParaObjetos } from "./csv";
import { lerReais } from "./dinheiro";
import { criarSlug } from "./texto";
import { ErroNegocio } from "./erros";

export const COLUNAS_IMPORTACAO = ["nome", "categoria", "variacao", "sku", "preco", "preco_de", "custo", "estoque", "descricao", "ativo"];

/**
 * Importa produtos de uma planilha. Linha com SKU que já existe atualiza a variação;
 * as outras criam o produto (pelo nome) e a variação.
 */
export async function importarProdutos(lojaId: number, texto: string) {
  const linhas = csvParaObjetos(texto);
  if (linhas.length === 0) throw new ErroNegocio("A planilha está vazia.");
  if (!("nome" in linhas[0]) || !("preco" in linhas[0])) throw new ErroNegocio('A planilha precisa ter pelo menos as colunas "nome" e "preco".');
  if (linhas.length > 3000) throw new ErroNegocio("Importe no máximo 3000 linhas por vez.");
  const erros: string[] = [];
  let criados = 0;
  let atualizados = 0;

  await db.transaction(async (tx) => {
    const cats = new Map((await tx.select().from(categorias).where(eq(categorias.lojaId, lojaId))).map((c) => [c.nome.toLowerCase(), c.id]));
    for (const [i, l] of linhas.entries()) {
      const n = i + 2;
      const nome = l.nome;
      const preco = lerReais(l.preco);
      if (!nome || preco == null || preco <= 0) {
        erros.push(`Linha ${n}: falta nome ou preço.`);
        continue;
      }
      const estoque = l.estoque ? parseInt(l.estoque, 10) : null;
      if (estoque != null && (!Number.isInteger(estoque) || estoque < 0)) {
        erros.push(`Linha ${n}: estoque inválido.`);
        continue;
      }
      const campos = {
        precoCentavos: preco,
        precoDeCentavos: lerReais(l.preco_de),
        ...(l.custo ? { custoCentavos: lerReais(l.custo) ?? 0 } : {}),
      };

      const [comSku] = l.sku
        ? await tx
            .select({ v: variantes })
            .from(variantes)
            .innerJoin(produtos, eq(produtos.id, variantes.produtoId))
            .where(and(eq(produtos.lojaId, lojaId), eq(variantes.sku, l.sku)))
        : [];
      if (comSku) {
        await tx.update(variantes).set({ ...campos, ...(estoque != null ? { estoque } : {}) }).where(eq(variantes.id, comSku.v.id));
        if (estoque != null && estoque !== comSku.v.estoque) {
          await tx.insert(movimentosEstoque).values({ lojaId, varianteId: comSku.v.id, quantidade: estoque - comSku.v.estoque, tipo: "ajuste", nota: "Importação de planilha" });
        }
        atualizados++;
        continue;
      }

      let categoriaId: number | null = null;
      if (l.categoria) {
        categoriaId = cats.get(l.categoria.toLowerCase()) ?? null;
        if (!categoriaId) {
          const [c] = await tx
            .insert(categorias)
            .values({ lojaId, nome: l.categoria, slug: criarSlug(l.categoria), ordem: cats.size })
            .onConflictDoNothing()
            .returning();
          categoriaId = c?.id ?? (await tx.select().from(categorias).where(and(eq(categorias.lojaId, lojaId), eq(categorias.slug, criarSlug(l.categoria)))))[0].id;
          cats.set(l.categoria.toLowerCase(), categoriaId);
        }
      }
      const slug = criarSlug(nome);
      let [produto] = await tx.select().from(produtos).where(and(eq(produtos.lojaId, lojaId), eq(produtos.slug, slug)));
      if (!produto) {
        [produto] = await tx
          .insert(produtos)
          .values({ lojaId, nome, slug, categoriaId, descricao: l.descricao ?? "", ativo: !/^(n|nao|0|false)$/i.test(l.ativo ?? "") })
          .returning();
      }
      const [v] = await tx
        .insert(variantes)
        .values({ produtoId: produto.id, nome: l.variacao || "Padrão", sku: l.sku || null, estoque: estoque ?? 0, ...campos })
        .returning();
      if ((estoque ?? 0) > 0) {
        await tx.insert(movimentosEstoque).values({ lojaId, varianteId: v.id, quantidade: estoque!, tipo: "entrada", nota: "Importação de planilha" });
      }
      criados++;
    }
  });
  return { criados, atualizados, erros };
}
