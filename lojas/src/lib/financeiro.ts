import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { lancamentos, type TipoLancamento } from "@/db/schema";
import { ErroNegocio } from "./erros";

export async function criarLancamento(l: {
  lojaId: number;
  tipo: TipoLancamento;
  categoria: string;
  descricao: string;
  valorCentavos: number;
  vencimento: string;
  pago: boolean;
}) {
  if (!l.descricao.trim()) throw new ErroNegocio("Informe a descrição.");
  if (!(l.valorCentavos > 0)) throw new ErroNegocio("Informe um valor maior que zero.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(l.vencimento)) throw new ErroNegocio("Data inválida.");
  const [novo] = await db
    .insert(lancamentos)
    .values({
      lojaId: l.lojaId,
      tipo: l.tipo,
      categoria: l.categoria.trim() || (l.tipo === "receita" ? "Outras receitas" : "Outras despesas"),
      descricao: l.descricao.trim(),
      valorCentavos: l.valorCentavos,
      vencimento: l.vencimento,
      status: l.pago ? "pago" : "pendente",
      pagoEm: l.pago ? new Date() : null,
    })
    .returning();
  return novo;
}

export async function quitarLancamento(id: number, lojaId: number) {
  await db
    .update(lancamentos)
    .set({ status: "pago", pagoEm: new Date() })
    .where(and(eq(lancamentos.id, id), eq(lancamentos.lojaId, lojaId), eq(lancamentos.status, "pendente")));
}

export async function cancelarLancamento(id: number, lojaId: number) {
  await db
    .update(lancamentos)
    .set({ status: "cancelado" })
    .where(and(eq(lancamentos.id, id), eq(lancamentos.lojaId, lojaId)));
}

/** totais do mês "AAAA-MM" pelo vencimento */
export async function resumoDoMes(lojaId: number, mes: string) {
  const inicio = `${mes}-01`;
  const [a, m] = mes.split("-").map(Number);
  const fim = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, "0")}-01`;
  const linhas = await db
    .select({
      tipo: lancamentos.tipo,
      status: lancamentos.status,
      total: sql<number>`coalesce(sum(${lancamentos.valorCentavos}), 0)::int`,
    })
    .from(lancamentos)
    .where(and(eq(lancamentos.lojaId, lojaId), gte(lancamentos.vencimento, inicio), lt(lancamentos.vencimento, fim)))
    .groupBy(lancamentos.tipo, lancamentos.status);
  const soma = (tipo: TipoLancamento, status: string) =>
    linhas.filter((l) => l.tipo === tipo && l.status === status).reduce((s, l) => s + l.total, 0);
  const recebido = soma("receita", "pago");
  const pago = soma("despesa", "pago");
  return {
    recebido,
    aReceber: soma("receita", "pendente"),
    pago,
    aPagar: soma("despesa", "pendente"),
    saldo: recebido - pago,
  };
}
