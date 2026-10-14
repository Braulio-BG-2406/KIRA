import "server-only";
import { and, asc, desc, eq, gte, inArray, lt, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { clientes, pedidoItens, pedidos, produtos, variantes, type Loja } from "@/db/schema";
import { inicioDoDiaSP, inicioDoMesSP } from "./datas";

const naoCancelado = ne(pedidos.status, "cancelado");

export async function totaisDeVendas(lojaId: number, desde: Date, ate?: Date) {
  const filtros = [eq(pedidos.lojaId, lojaId), naoCancelado, gte(pedidos.criadoEm, desde)];
  if (ate) filtros.push(lt(pedidos.criadoEm, ate));
  const [v] = await db
    .select({
      pedidos: sql<number>`count(*)::int`,
      total: sql<number>`coalesce(sum(${pedidos.totalCentavos}), 0)::int`,
      descontos: sql<number>`coalesce(sum(${pedidos.descontoCentavos}), 0)::int`,
    })
    .from(pedidos)
    .where(and(...filtros));
  const [m] = await db
    .select({
      margem: sql<number>`coalesce(sum((${pedidoItens.precoUnitCentavos} - ${pedidoItens.custoUnitCentavos}) * ${pedidoItens.quantidade}), 0)::int`,
    })
    .from(pedidoItens)
    .innerJoin(pedidos, eq(pedidos.id, pedidoItens.pedidoId))
    .where(and(...filtros));
  return { pedidos: v.pedidos, totalCentavos: v.total, lucroBrutoCentavos: m.margem - v.descontos };
}

export async function estoqueBaixo(loja: Loja, limite = 50) {
  return db
    .select({
      varianteId: variantes.id,
      produtoId: produtos.id,
      produto: produtos.nome,
      variante: variantes.nome,
      sku: variantes.sku,
      estoque: variantes.estoque,
    })
    .from(variantes)
    .innerJoin(produtos, eq(produtos.id, variantes.produtoId))
    .where(and(eq(produtos.lojaId, loja.id), eq(produtos.ativo, true), eq(variantes.ativo, true), lte(variantes.estoque, loja.estoqueMinimo)))
    .orderBy(asc(variantes.estoque), asc(produtos.nome))
    .limit(limite);
}

export async function contarPorStatus(lojaId: number) {
  const linhas = await db
    .select({ status: pedidos.status, n: sql<number>`count(*)::int` })
    .from(pedidos)
    .where(eq(pedidos.lojaId, lojaId))
    .groupBy(pedidos.status);
  return Object.fromEntries(linhas.map((l) => [l.status, l.n])) as Partial<Record<string, number>>;
}

export async function pedidosRecentes(lojaId: number, status: string[], limite = 10) {
  return db
    .select({ p: pedidos, cliente: clientes.nome })
    .from(pedidos)
    .leftJoin(clientes, eq(clientes.id, pedidos.clienteId))
    .where(and(eq(pedidos.lojaId, lojaId), inArray(pedidos.status, status as never[])))
    .orderBy(desc(pedidos.criadoEm))
    .limit(limite);
}

export async function resumoDaLoja(loja: Loja, agora = new Date()) {
  const [hoje, mes, porStatus, baixo] = await Promise.all([
    totaisDeVendas(loja.id, inicioDoDiaSP(agora)),
    totaisDeVendas(loja.id, inicioDoMesSP(agora)),
    contarPorStatus(loja.id),
    estoqueBaixo(loja, 20),
  ]);
  return {
    loja: { slug: loja.slug, nome: loja.nome },
    hoje,
    mes,
    ticketMedioMesCentavos: mes.pedidos ? Math.round(mes.totalCentavos / mes.pedidos) : 0,
    aguardandoPagamento: porStatus.aguardando_pagamento ?? 0,
    aEnviar: (porStatus.pago ?? 0) + (porStatus.separacao ?? 0),
    estoqueBaixo: baixo,
  };
}
