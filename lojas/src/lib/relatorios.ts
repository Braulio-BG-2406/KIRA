import "server-only";
import { and, asc, desc, eq, gte, lt, ne, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { clientes, pedidoItens, pedidos, produtos, variantes } from "@/db/schema";
import { diaSP, hojeSP, somarDias } from "./datas";

export type Periodo = { de: string; ate: string; inicio: Date; fim: Date };

/** período "AAAA-MM-DD" a "AAAA-MM-DD" (inclusive), padrão: mês atual */
export function lerPeriodo(de?: string, ate?: string): Periodo {
  const hoje = hojeSP();
  const ok = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);
  const d1 = ok(de) ?? `${hoje.slice(0, 7)}-01`;
  const d2 = ok(ate) ?? hoje;
  const [a, b] = d1 <= d2 ? [d1, d2] : [d2, d1];
  return { de: a, ate: b, inicio: diaSP(a), fim: somarDias(diaSP(b), 1) };
}

export async function relatorioDeVendas(lojaId: number, p: Periodo) {
  const filtro = and(eq(pedidos.lojaId, lojaId), ne(pedidos.status, "cancelado"), gte(pedidos.criadoEm, p.inicio), lt(pedidos.criadoEm, p.fim));
  const soma = (c: AnyPgColumn) => sql<number>`coalesce(sum(${c}), 0)::int`;
  const [totais, porCanal, porPagamento, porDia, topProdutos, custo] = await Promise.all([
    db
      .select({
        pedidos: sql<number>`count(*)::int`,
        total: soma(pedidos.totalCentavos),
        subtotal: soma(pedidos.subtotalCentavos),
        descontos: soma(pedidos.descontoCentavos),
        frete: soma(pedidos.freteCentavos),
      })
      .from(pedidos)
      .where(filtro),
    db.select({ canal: pedidos.canal, pedidos: sql<number>`count(*)::int`, total: soma(pedidos.totalCentavos) }).from(pedidos).where(filtro).groupBy(pedidos.canal).orderBy(desc(sql`2`)),
    db
      .select({ forma: pedidos.formaPagamento, pedidos: sql<number>`count(*)::int`, total: soma(pedidos.totalCentavos) })
      .from(pedidos)
      .where(filtro)
      .groupBy(pedidos.formaPagamento)
      .orderBy(desc(sql`3`)),
    db
      .select({
        dia: sql<string>`to_char(${pedidos.criadoEm} at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`,
        pedidos: sql<number>`count(*)::int`,
        total: soma(pedidos.totalCentavos),
      })
      .from(pedidos)
      .where(filtro)
      .groupBy(sql`1`)
      .orderBy(asc(sql`1`)),
    db
      .select({
        produto: pedidoItens.produtoNome,
        quantidade: sql<number>`sum(${pedidoItens.quantidade})::int`,
        receita: sql<number>`sum(${pedidoItens.precoUnitCentavos} * ${pedidoItens.quantidade})::int`,
        lucro: sql<number>`sum((${pedidoItens.precoUnitCentavos} - ${pedidoItens.custoUnitCentavos}) * ${pedidoItens.quantidade})::int`,
      })
      .from(pedidoItens)
      .innerJoin(pedidos, eq(pedidos.id, pedidoItens.pedidoId))
      .where(filtro)
      .groupBy(pedidoItens.produtoNome)
      .orderBy(desc(sql`3`))
      .limit(20),
    db
      .select({ custo: sql<number>`coalesce(sum(${pedidoItens.custoUnitCentavos} * ${pedidoItens.quantidade}), 0)::int` })
      .from(pedidoItens)
      .innerJoin(pedidos, eq(pedidos.id, pedidoItens.pedidoId))
      .where(filtro),
  ]);
  const t = totais[0];
  return {
    ...t,
    custo: custo[0].custo,
    lucroBruto: t.subtotal - t.descontos - custo[0].custo,
    ticketMedio: t.pedidos ? Math.round(t.total / t.pedidos) : 0,
    porCanal,
    porPagamento,
    porDia,
    topProdutos,
  };
}

export async function linhasPedidosCsv(lojaId: number, p: Periodo) {
  return db
    .select({ p: pedidos, cliente: clientes.nome, telefone: clientes.telefone, email: clientes.email })
    .from(pedidos)
    .leftJoin(clientes, eq(clientes.id, pedidos.clienteId))
    .where(and(eq(pedidos.lojaId, lojaId), gte(pedidos.criadoEm, p.inicio), lt(pedidos.criadoEm, p.fim)))
    .orderBy(asc(pedidos.numero));
}

export async function linhasItensCsv(lojaId: number, p: Periodo) {
  return db
    .select({ i: pedidoItens, numero: pedidos.numero, status: pedidos.status, criadoEm: pedidos.criadoEm })
    .from(pedidoItens)
    .innerJoin(pedidos, eq(pedidos.id, pedidoItens.pedidoId))
    .where(and(eq(pedidos.lojaId, lojaId), gte(pedidos.criadoEm, p.inicio), lt(pedidos.criadoEm, p.fim)))
    .orderBy(asc(pedidos.numero), asc(pedidoItens.id));
}

export async function linhasEstoqueCsv(lojaId: number) {
  return db
    .select({ v: variantes, produto: produtos.nome, ativo: produtos.ativo })
    .from(variantes)
    .innerJoin(produtos, eq(produtos.id, variantes.produtoId))
    .where(eq(produtos.lojaId, lojaId))
    .orderBy(asc(produtos.nome), asc(variantes.ordem));
}
