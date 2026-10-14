import Link from "next/link";
import { and, eq, ilike, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { clientes, pedidos } from "@/db/schema";
import { contexto } from "@/lib/painel";
import { formatarReais } from "@/lib/dinheiro";
import { formatarData } from "@/lib/datas";
import { Cabecalho, Cartao, Tabela, Vazio } from "@/components/admin/ui";

export default async function Clientes({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { loja } = await contexto();
  const busca = (await searchParams).q?.trim() ?? "";
  const filtros: SQL[] = [eq(clientes.lojaId, loja.id)];
  if (busca) {
    const termo = `%${busca.replace(/[%_\\]/g, "\\$&")}%`;
    filtros.push(or(ilike(clientes.nome, termo), ilike(clientes.email, termo), ilike(clientes.telefone, termo))!);
  }
  const lista = await db
    .select({
      c: clientes,
      pedidos: sql<number>`count(${pedidos.id})::int`,
      total: sql<number>`coalesce(sum(${pedidos.totalCentavos}), 0)::int`,
      ultimo: sql<Date | null>`max(${pedidos.criadoEm})`,
    })
    .from(clientes)
    .leftJoin(pedidos, and(eq(pedidos.clienteId, clientes.id), ne(pedidos.status, "cancelado")))
    .where(and(...filtros))
    .groupBy(clientes.id)
    .orderBy(sql`max(${pedidos.criadoEm}) desc nulls last`, clientes.nome)
    .limit(300);

  return (
    <>
      <Cabecalho titulo="Clientes" />
      <Cartao>
        <form className="mb-4 flex gap-2">
          <input name="q" defaultValue={busca} placeholder="Nome, e-mail ou telefone" className="campo max-w-sm" />
          <button className="botao-secundario">Buscar</button>
        </form>
        {lista.length === 0 ? (
          <Vazio>Os clientes aparecem aqui a partir da primeira compra.</Vazio>
        ) : (
          <Tabela>
            <thead>
              <tr><th>Nome</th><th>Contato</th><th className="text-right">Pedidos</th><th className="text-right">Total gasto</th><th>Última compra</th></tr>
            </thead>
            <tbody>
              {lista.map(({ c, pedidos: n, total, ultimo }) => (
                <tr key={c.id} className="hover:bg-stone-50">
                  <td><Link href={`/admin/clientes/${c.id}`} className="font-medium hover:underline">{c.nome}</Link></td>
                  <td className="text-stone-600">{c.telefone ?? c.email ?? "—"}</td>
                  <td className="text-right tabular-nums">{n}</td>
                  <td className="text-right tabular-nums">{formatarReais(total)}</td>
                  <td className="text-stone-500">{formatarData(ultimo)}</td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </Cartao>
    </>
  );
}
