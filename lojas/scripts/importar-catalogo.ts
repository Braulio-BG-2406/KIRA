// Importa para uma loja o catálogo lido de um site antigo (pasta migracao-infinite/ do repositório):
// coleções, peças, opções, códigos, preços, estoque e fotos.
//
//   npx tsx scripts/importar-catalogo.ts <slug-da-loja> <pasta>
//
// <pasta> precisa ter catalogo/catalogo.json (gerado por migracao-infinite/scripts/raspar.py) e fotos/.
// Pode rodar de novo: peça que já existe (mesmo endereço) é pulada, e as fotos têm nome fixo.
// Com --atualizar, as peças que já existem recebem preço e estoque do arquivo.
import { copyFile, mkdir, stat } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db, fecharDb } from "../src/db";
import { categorias, lojas, movimentosEstoque, produtoImagens, produtos, variantes } from "../src/db/schema";
import { criarSlug } from "../src/lib/texto";

type VarianteSite = { slug: string; nome: string; sku: string | null; preco: string | null; preco_de: string | null; estoque: number | null; disponivel: boolean; fotos: string[] };
type ProdutoSite = {
  slug: string;
  nome: string;
  sku: string | null;
  preco: string | null;
  preco_de: string | null;
  disponivel: boolean;
  estoque: number | null;
  categoria: string | null;
  categoria_slug: string | null;
  fotos: string[];
  descricao: string;
  especificacoes: [string, string][];
  variantes: VarianteSite[];
};

const DESCRICAO_GENERICA = "Fale com a gente pelo WhatsApp";
const PASTA_UPLOADS = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");

/** "232.90" ou "232,90" -> 23290 */
function centavos(v: string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).includes(",") ? String(v).replace(/\./g, "").replace(",", ".") : v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

/** nome do arquivo no /uploads: fixo, para a importação poder ser repetida */
function nomeFoto(arquivo: string) {
  const base = path.basename(arquivo).replace(/\.[a-z0-9]+$/i, "").replace(/[^\w-]/g, "");
  return `site-${base}.webp`;
}

async function existe(arquivo: string) {
  return stat(arquivo).then(
    () => true,
    () => false,
  );
}

async function main() {
  const [slugLoja, pasta] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const atualizar = process.argv.includes("--atualizar");
  if (!slugLoja || !pasta) {
    console.error("Uso: npx tsx scripts/importar-catalogo.ts <slug-da-loja> <pasta> [--atualizar]");
    process.exit(1);
  }
  const [loja] = await db.select().from(lojas).where(eq(lojas.slug, slugLoja));
  if (!loja) throw new Error(`Loja "${slugLoja}" não encontrada.`);
  const catalogo: ProdutoSite[] = JSON.parse(readFileSync(path.join(pasta, "catalogo", "catalogo.json"), "utf8"));
  const pastaFotos = path.join(pasta, "fotos");
  await mkdir(PASTA_UPLOADS, { recursive: true });

  const cats = new Map((await db.select().from(categorias).where(eq(categorias.lojaId, loja.id))).map((c) => [c.slug, c.id]));
  async function categoriaId(nome: string | null, slug: string | null) {
    if (!nome) return null;
    const s = slug || criarSlug(nome);
    if (!cats.has(s)) {
      const [c] = await db.insert(categorias).values({ lojaId: loja.id, nome, slug: s, ordem: cats.size }).onConflictDoNothing().returning();
      cats.set(s, c?.id ?? (await db.select().from(categorias).where(and(eq(categorias.lojaId, loja.id), eq(categorias.slug, s))))[0].id);
    }
    return cats.get(s)!;
  }

  // o site lista do mais novo para o mais antigo: a ordem vira a data de cadastro (para "Novidades")
  const agora = Date.now();
  const skusUsados = new Set<string>();
  let criados = 0;
  let atualizados = 0;
  let pulados = 0;
  let fotos = 0;
  const semPreco: string[] = [];

  for (const [i, p] of catalogo.entries()) {
    const opcoes: VarianteSite[] = p.variantes.length
      ? p.variantes
      : [{ slug: p.slug, nome: "Padrão", sku: p.sku, preco: p.preco, preco_de: p.preco_de, estoque: p.estoque, disponivel: p.disponivel, fotos: p.fotos }];
    const linhas = opcoes
      .map((v, ordem) => {
        let sku = v.sku?.trim() || null;
        // o site antigo repete o código nas opções (Ouro/Ródio): a partir da segunda, ganha a opção no fim
        if (sku && skusUsados.has(sku)) sku = `${sku}-${criarSlug(v.nome).toUpperCase()}`;
        if (sku) skusUsados.add(sku);
        return {
          nome: v.nome,
          sku,
          precoCentavos: centavos(v.preco) ?? 0,
          precoDeCentavos: centavos(v.preco_de),
          estoque: v.estoque ?? 0,
          ordem,
        };
      })
      .filter((v) => v.precoCentavos > 0);
    if (linhas.length === 0) {
      semPreco.push(p.nome);
      continue;
    }

    const [existente] = await db.select().from(produtos).where(and(eq(produtos.lojaId, loja.id), eq(produtos.slug, p.slug)));
    if (existente) {
      if (!atualizar) {
        pulados++;
        continue;
      }
      const atuais = await db.select().from(variantes).where(eq(variantes.produtoId, existente.id));
      for (const l of linhas) {
        const v = atuais.find((a) => a.nome === l.nome);
        if (!v) continue;
        await db.update(variantes).set({ precoCentavos: l.precoCentavos, precoDeCentavos: l.precoDeCentavos, estoque: l.estoque }).where(eq(variantes.id, v.id));
        if (l.estoque !== v.estoque) {
          await db.insert(movimentosEstoque).values({ lojaId: loja.id, varianteId: v.id, quantidade: l.estoque - v.estoque, tipo: "ajuste", nota: "Importação do site antigo" });
        }
      }
      atualizados++;
      continue;
    }

    const descricao = p.descricao?.startsWith(DESCRICAO_GENERICA) ? "" : (p.descricao ?? "").trim();
    const especificacoes = (p.especificacoes ?? []).filter(([n]) => n !== "Código" && n !== "Garantia").map(([nome, valor]) => ({ nome, valor }));
    const criadoEm = new Date(agora - i * 1000);
    await db.transaction(async (tx) => {
      const [novo] = await tx
        .insert(produtos)
        .values({
          lojaId: loja.id,
          categoriaId: await categoriaId(p.categoria, p.categoria_slug),
          nome: p.nome.trim(),
          slug: p.slug,
          descricao,
          especificacoes,
          garantia: "90 dias",
          ativo: true,
          criadoEm,
          atualizadoEm: criadoEm,
        })
        .returning();
      for (const l of linhas) {
        const [v] = await tx.insert(variantes).values({ produtoId: novo.id, ...l }).returning();
        if (l.estoque > 0) {
          await tx.insert(movimentosEstoque).values({ lojaId: loja.id, varianteId: v.id, quantidade: l.estoque, tipo: "entrada", nota: "Importação do site antigo" });
        }
      }
      const arquivos = [...new Set([...p.fotos, ...opcoes.flatMap((v) => v.fotos ?? [])])];
      let ordem = 0;
      for (const arquivo of arquivos) {
        const origem = path.join(pastaFotos, arquivo.replace(/\.[a-z0-9]+$/i, ".webp"));
        if (!(await existe(origem))) continue;
        const nome = nomeFoto(arquivo);
        const destino = path.join(PASTA_UPLOADS, nome);
        if (!(await existe(destino))) await copyFile(origem, destino);
        await tx.insert(produtoImagens).values({ produtoId: novo.id, url: `/uploads/${nome}`, ordem: ordem++ });
        fotos++;
      }
    });
    criados++;
  }

  console.log(`${loja.nome}: ${criados} peças criadas, ${fotos} fotos, ${atualizados} atualizadas, ${pulados} já existiam.`);
  if (semPreco.length) console.log(`Sem preço (não importadas): ${semPreco.join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => fecharDb());
