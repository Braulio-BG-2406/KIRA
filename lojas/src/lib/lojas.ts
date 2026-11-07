import "server-only";
import { cache } from "react";
import { headers, cookies } from "next/headers";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { lojas, type Loja } from "@/db/schema";

export const buscarLoja = cache(async (slug: string): Promise<Loja | null> => {
  const [loja] = await db.select().from(lojas).where(eq(lojas.slug, slug));
  return loja ?? null;
});

export const todasAsLojas = cache(async () => db.select().from(lojas).orderBy(asc(lojas.id)));

/**
 * Prefixo dos links da vitrine: vazio quando a loja é acessada pelo próprio domínio
 * (o middleware avisa pelo cabeçalho), "/loja/<slug>" no resto.
 */
export async function baseDaLoja(slug: string): Promise<string> {
  return (await headers()).get("x-loja-dominio") === slug ? "" : `/loja/${slug}`;
}

/** loja escolhida no painel */
export async function lojaDoPainel(): Promise<Loja> {
  const todas = await todasAsLojas();
  if (todas.length === 0) throw new Error("Nenhuma loja cadastrada. Rode: npm run db:seed");
  const slug = (await cookies()).get("loja_painel")?.value;
  return todas.find((l) => l.slug === slug) ?? todas[0];
}
