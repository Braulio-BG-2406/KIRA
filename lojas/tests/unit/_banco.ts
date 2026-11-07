import path from "node:path";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "@/db";
import { lojas, produtos, variantes, FRETE_PADRAO } from "@/db/schema";

let migrado = false;

export async function banco() {
  if (!migrado) {
    await migrate(db, { migrationsFolder: path.join(__dirname, "../../drizzle") });
    migrado = true;
  }
  await db.execute(sql`
    truncate lojas, usuarios, sessoes restart identity cascade
  `);
}

export async function criarLoja(slug = "teste") {
  const [loja] = await db
    .insert(lojas)
    .values({
      slug,
      nome: "Loja Teste",
      frete: { ...FRETE_PADRAO, entrega: { ...FRETE_PADRAO.entrega, valorPadraoCentavos: 2000, porUF: { SP: 1000 }, gratisAcimaCentavos: 30000 } },
    })
    .returning();
  return loja;
}

export async function criarProduto(lojaId: number, nome: string, precoCentavos: number, estoque: number, custoCentavos = 0) {
  const [p] = await db.insert(produtos).values({ lojaId, nome, slug: nome.toLowerCase().replace(/\s+/g, "-") }).returning();
  const [v] = await db.insert(variantes).values({ produtoId: p.id, precoCentavos, estoque, custoCentavos }).returning();
  return { produto: p, variante: v };
}
