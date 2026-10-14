"use server";

import { and, asc, eq, inArray, max, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { categorias, compraItens, movimentosEstoque, pedidoItens, produtoImagens, produtos, variantes } from "@/db/schema";
import { contexto, executar, inteiro, marcado, texto, textoOuNulo } from "@/lib/painel";
import { ErroNegocio } from "@/lib/erros";
import { lerReais } from "@/lib/dinheiro";
import { criarSlug } from "@/lib/texto";
import { apagarImagem, salvarImagem } from "@/lib/uploads";

type VarianteForm = { id?: number; nome: string; sku: string; codigoBarras: string; preco: string; precoDe: string; custo: string; estoque: string; ativo: boolean };

function lerVariantes(fd: FormData) {
  let lista: VarianteForm[];
  try {
    lista = JSON.parse(String(fd.get("variantes") ?? "[]"));
  } catch {
    throw new ErroNegocio("Variações inválidas.");
  }
  if (!Array.isArray(lista) || lista.length === 0) throw new ErroNegocio("Cadastre pelo menos uma variação com preço.");
  return lista.map((v, i) => {
    const preco = lerReais(v.preco);
    if (preco == null || preco <= 0) throw new ErroNegocio(`Informe o preço da variação ${i + 1}.`);
    const estoque = parseInt(String(v.estoque || "0"), 10);
    if (!Number.isInteger(estoque) || estoque < 0) throw new ErroNegocio(`Estoque inválido na variação ${i + 1}.`);
    return {
      id: v.id ? Number(v.id) : undefined,
      nome: String(v.nome ?? "").trim() || "Padrão",
      sku: String(v.sku ?? "").trim() || null,
      codigoBarras: String(v.codigoBarras ?? "").replace(/\s/g, "") || null,
      precoCentavos: preco,
      precoDeCentavos: lerReais(v.precoDe),
      custoCentavos: lerReais(v.custo) ?? 0,
      estoque,
      ativo: v.ativo !== false,
      ordem: i,
    };
  });
}

async function produtoDaLoja(id: number, lojaId: number) {
  const [p] = await db.select().from(produtos).where(and(eq(produtos.id, id), eq(produtos.lojaId, lojaId)));
  if (!p) throw new ErroNegocio("Produto não encontrado.");
  return p;
}

export async function acaoSalvarProduto(fd: FormData) {
  const { loja } = await contexto();
  const id = inteiro(fd, "id") || null;
  await executar(id ? `/admin/produtos/${id}` : "/admin/produtos/novo", async () => {
    const nome = texto(fd, "nome");
    if (!nome) throw new ErroNegocio("Informe o nome do produto.");
    const vs = lerVariantes(fd);
    const categoriaId = inteiro(fd, "categoriaId") || null;
    if (categoriaId) {
      const [c] = await db.select().from(categorias).where(and(eq(categorias.id, categoriaId), eq(categorias.lojaId, loja.id)));
      if (!c) throw new ErroNegocio("Categoria inválida.");
    }
    let especificacoes: { nome: string; valor: string }[] = [];
    try {
      especificacoes = (JSON.parse(texto(fd, "especificacoes") || "[]") as { nome: string; valor: string }[])
        .map((e) => ({ nome: String(e.nome).trim().slice(0, 60), valor: String(e.valor).trim().slice(0, 200) }))
        .filter((e) => e.nome && e.valor)
        .slice(0, 30);
    } catch {
      throw new ErroNegocio("Ficha técnica inválida.");
    }
    const fotos = fd.getAll("fotos").filter((f): f is File => f instanceof File && f.size > 0);
    const dados = {
      nome,
      categoriaId,
      descricao: texto(fd, "descricao"),
      marca: textoOuNulo(fd, "marca"),
      especificacoes,
      garantia: textoOuNulo(fd, "garantia"),
      itensInclusos: textoOuNulo(fd, "itensInclusos"),
      ativo: marcado(fd, "ativo"),
      destaque: marcado(fd, "destaque"),
      atualizadoEm: new Date(),
    };

    const salvo = await db.transaction(async (tx) => {
      // endereço da página: o nome em minúsculas, com número no fim se já existir
      const base = criarSlug(texto(fd, "slug") || nome);
      let slug = base;
      for (let n = 2; ; n++) {
        const filtro = [eq(produtos.lojaId, loja.id), eq(produtos.slug, slug)];
        if (id) filtro.push(ne(produtos.id, id));
        const [existe] = await tx.select({ id: produtos.id }).from(produtos).where(and(...filtro));
        if (!existe) break;
        slug = `${base}-${n}`;
      }

      let produtoId: number;
      if (id) {
        await produtoDaLoja(id, loja.id);
        await tx.update(produtos).set({ ...dados, slug }).where(eq(produtos.id, id));
        produtoId = id;
      } else {
        const [novo] = await tx.insert(produtos).values({ ...dados, slug, lojaId: loja.id }).returning({ id: produtos.id });
        produtoId = novo.id;
      }

      const atuais = await tx.select().from(variantes).where(eq(variantes.produtoId, produtoId)).for("update");
      for (const v of vs) {
        const { id: vid, estoque, ...campos } = v;
        const atual = vid ? atuais.find((a) => a.id === vid) : undefined;
        if (atual) {
          await tx.update(variantes).set({ ...campos, estoque }).where(eq(variantes.id, atual.id));
          if (estoque !== atual.estoque) {
            await tx.insert(movimentosEstoque).values({
              lojaId: loja.id,
              varianteId: atual.id,
              quantidade: estoque - atual.estoque,
              tipo: "ajuste",
              nota: `Editado no cadastro: ${atual.estoque} → ${estoque}`,
            });
          }
        } else {
          const [nova] = await tx.insert(variantes).values({ ...campos, estoque, produtoId }).returning({ id: variantes.id });
          if (estoque > 0) {
            await tx.insert(movimentosEstoque).values({ lojaId: loja.id, varianteId: nova.id, quantidade: estoque, tipo: "entrada", nota: "Estoque inicial" });
          }
        }
      }
      // variação que saiu do formulário: some se nunca vendeu/comprou, senão só desativa
      const removidas = atuais.filter((a) => !vs.some((v) => v.id === a.id)).map((a) => a.id);
      if (removidas.length) {
        const usadas = new Set([
          ...(await tx.select({ id: pedidoItens.varianteId }).from(pedidoItens).where(inArray(pedidoItens.varianteId, removidas))).map((r) => r.id),
          ...(await tx.select({ id: compraItens.varianteId }).from(compraItens).where(inArray(compraItens.varianteId, removidas))).map((r) => r.id),
        ]);
        const apagar = removidas.filter((r) => !usadas.has(r));
        const desativar = removidas.filter((r) => usadas.has(r));
        if (apagar.length) await tx.delete(variantes).where(inArray(variantes.id, apagar));
        if (desativar.length) await tx.update(variantes).set({ ativo: false }).where(inArray(variantes.id, desativar));
      }
      return produtoId;
    });
    await guardarFotos(salvo, fotos);
    return `/admin/produtos/${salvo}`;
  }, "Produto salvo.");
}

async function guardarFotos(produtoId: number, arquivos: File[]) {
  if (arquivos.length === 0) return;
  const [{ ultima }] = await db.select({ ultima: max(produtoImagens.ordem) }).from(produtoImagens).where(eq(produtoImagens.produtoId, produtoId));
  let ordem = (ultima ?? -1) + 1;
  for (const arquivo of arquivos.slice(0, 12)) {
    const url = await salvarImagem(arquivo);
    await db.insert(produtoImagens).values({ produtoId, url, ordem: ordem++ });
  }
}

async function imagemDaLoja(imagemId: number, lojaId: number) {
  const [img] = await db
    .select({ i: produtoImagens })
    .from(produtoImagens)
    .innerJoin(produtos, eq(produtos.id, produtoImagens.produtoId))
    .where(and(eq(produtoImagens.id, imagemId), eq(produtos.lojaId, lojaId)));
  if (!img) throw new ErroNegocio("Foto não encontrada.");
  return img.i;
}

export async function acaoRemoverFoto(fd: FormData) {
  const { loja } = await contexto();
  const produtoId = inteiro(fd, "produtoId");
  await executar(`/admin/produtos/${produtoId}`, async () => {
    const img = await imagemDaLoja(inteiro(fd, "imagemId"), loja.id);
    await db.delete(produtoImagens).where(eq(produtoImagens.id, img.id));
    await apagarImagem(img.url);
  }, "Foto removida.");
}

export async function acaoFotoPrincipal(fd: FormData) {
  const { loja } = await contexto();
  const produtoId = inteiro(fd, "produtoId");
  await executar(`/admin/produtos/${produtoId}`, async () => {
    const img = await imagemDaLoja(inteiro(fd, "imagemId"), loja.id);
    const todas = await db.select().from(produtoImagens).where(eq(produtoImagens.produtoId, img.produtoId)).orderBy(asc(produtoImagens.ordem), asc(produtoImagens.id));
    const nova = [img, ...todas.filter((t) => t.id !== img.id)];
    for (const [ordem, t] of nova.entries()) await db.update(produtoImagens).set({ ordem }).where(eq(produtoImagens.id, t.id));
  }, "Foto principal definida.");
}

export async function acaoExcluirProduto(fd: FormData) {
  const { loja } = await contexto();
  const id = inteiro(fd, "id");
  await executar(`/admin/produtos/${id}`, async () => {
    await produtoDaLoja(id, loja.id);
    const ids = (await db.select({ id: variantes.id }).from(variantes).where(eq(variantes.produtoId, id))).map((v) => v.id);
    if (ids.length) {
      const [{ n }] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(pedidoItens)
        .where(inArray(pedidoItens.varianteId, ids));
      const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(compraItens).where(inArray(compraItens.varianteId, ids));
      if (n + c > 0) throw new ErroNegocio("Este produto já tem vendas ou compras. Desmarque \"À venda\" em vez de excluir.");
    }
    const imgs = await db.select().from(produtoImagens).where(eq(produtoImagens.produtoId, id));
    await db.delete(produtos).where(eq(produtos.id, id));
    for (const i of imgs) await apagarImagem(i.url);
    return "/admin/produtos";
  }, "Produto excluído.");
}
