import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { categorias, movimentosEstoque, produtos, variantes, type Especificacao } from "@/db/schema";
import { csvParaObjetos } from "./csv";
import { lerReais } from "./dinheiro";
import { criarSlug } from "./texto";
import { ErroNegocio } from "./erros";

export const COLUNAS_IMPORTACAO = ["nome", "marca", "categoria", "variacao", "sku", "codigo_barras", "preco", "preco_de", "custo", "estoque", "descricao", "ficha", "garantia", "vem_com", "ativo"];

/** "Caixa: 42 mm | Vidro: mineral" → [{ nome: "Caixa", valor: "42 mm" }, …] */
export function lerFicha(texto: string | undefined): Especificacao[] {
  if (!texto) return [];
  return texto
    .split("|")
    .map((par) => {
      const i = par.indexOf(":");
      return i > 0 ? { nome: par.slice(0, i).trim(), valor: par.slice(i + 1).trim() } : null;
    })
    .filter((e): e is Especificacao => !!e && !!e.nome && !!e.valor);
}

const inativo = (v: string | undefined) => /^(n|nao|não|0|false)$/i.test(v ?? "");

/**
 * Importa produtos de uma planilha. Linha com SKU que já existe atualiza a variação;
 * as outras criam o produto (pelo nome) e a variação.
 * Peça sem preço entra como rascunho (inativa) quando a coluna ativo diz "nao".
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
      const semPreco = preco == null || preco <= 0;
      // a exportação manda 0,00 nos rascunhos, então zero também conta como "sem preço"
      const rascunho = semPreco && inativo(l.ativo);
      if (!nome || (semPreco && !rascunho)) {
        erros.push(`Linha ${n}: falta nome ou preço.`);
        continue;
      }
      const estoque = l.estoque ? parseInt(l.estoque, 10) : null;
      if (estoque != null && (!Number.isInteger(estoque) || estoque < 0)) {
        erros.push(`Linha ${n}: estoque inválido.`);
        continue;
      }
      const campos = {
        ...(l.codigo_barras ? { codigoBarras: l.codigo_barras.replace(/\s/g, "") } : {}),
        ...(!semPreco ? { precoCentavos: preco } : {}),
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
      const ficha = lerFicha(l.ficha);
      const extras = {
        ...(ficha.length ? { especificacoes: ficha } : {}),
        ...(l.garantia ? { garantia: l.garantia } : {}),
        ...(l.vem_com ? { itensInclusos: l.vem_com } : {}),
      };
      let [produto] = await tx.select().from(produtos).where(and(eq(produtos.lojaId, lojaId), eq(produtos.slug, slug)));
      if (!produto) {
        [produto] = await tx
          .insert(produtos)
          .values({ lojaId, nome, slug, categoriaId, marca: l.marca || null, descricao: l.descricao ?? "", ativo: !inativo(l.ativo), ...extras })
          .returning();
      } else if (rascunho && produto.ativo) {
        erros.push(`Linha ${n}: falta o preço (o produto já está à venda).`);
        continue;
      } else if (Object.keys(extras).length) {
        await tx.update(produtos).set(extras).where(eq(produtos.id, produto.id));
      }
      const [v] = await tx
        .insert(variantes)
        .values({ produtoId: produto.id, nome: l.variacao || "Padrão", sku: l.sku || null, estoque: estoque ?? 0, precoCentavos: 0, ...campos })
        .returning();
      if ((estoque ?? 0) > 0) {
        await tx.insert(movimentosEstoque).values({ lojaId, varianteId: v.id, quantidade: estoque!, tipo: "entrada", nota: "Importação de planilha" });
      }
      criados++;
    }
  });
  return { criados, atualizados, erros };
}
