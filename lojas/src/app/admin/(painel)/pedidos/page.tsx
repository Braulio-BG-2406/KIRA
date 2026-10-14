import Link from "next/link";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { clientes, pedidos, type StatusPedido } from "@/db/schema";
import { contexto } from "@/lib/painel";
import { contarPorStatus } from "@/lib/consultas";
import { formatarReais } from "@/lib/dinheiro";
import { formatarDataHora } from "@/lib/datas";
import { NOMES_CANAL, NOMES_PAGAMENTO, NOMES_STATUS } from "@/lib/rotulos";
import { Aviso, Cabecalho, Cartao, Etiqueta, Tabela, Vazio } from "@/components/admin/ui";

const POR_PAGINA = 50;

export default async function Pedidos({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { loja } = await contexto();
  const sp = await searchParams;
  const status = sp.status && sp.status in NOMES_STATUS ? (sp.status as StatusPedido) : null;
  const busca = sp.q?.trim() ?? "";
  const pagina = Math.max(1, parseInt(sp.pagina ?? "1", 10) || 1);

  const filtros: SQL[] = [eq(pedidos.lojaId, loja.id)];
  if (status) filtros.push(eq(pedidos.status, status));
  if (busca) {
    const termo = `%${busca.replace(/[%_\\]/g, "\\$&")}%`;
    const numero = parseInt(busca.replace("#", ""), 10);
    filtros.push(
      or(
        ilike(clientes.nome, termo),
        ilike(clientes.telefone, termo),
        ilike(pedidos.codigo, termo),
        Number.isFinite(numero) ? eq(pedidos.numero, numero) : sql`false`,
      )!,
    );
  }
  const [lista, contagem] = await Promise.all([
    db
      .select({ p: pedidos, cliente: clientes.nome })
      .from(pedidos)
      .leftJoin(clientes, eq(clientes.id, pedidos.clienteId))
      .where(and(...filtros))
      .orderBy(desc(pedidos.criadoEm))
      .limit(POR_PAGINA + 1)
      .offset((pagina - 1) * POR_PAGINA),
    contarPorStatus(loja.id),
  ]);
  const temMais = lista.length > POR_PAGINA;
  const link = (extra: Record<string, string | number | null>) => {
    const q = new URLSearchParams();
    const tudo = { status, q: busca || null, ...extra };
    for (const [k, v] of Object.entries(tudo)) if (v != null && v !== "") q.set(k, String(v));
    return `/admin/pedidos${q.size ? `?${q}` : ""}`;
  };

  return (
    <>
      <Cabecalho titulo="Pedidos">
        <Link href="/admin/relatorios" className="botao-secundario">Exportar</Link>
        <Link href="/admin/pedidos/novo" className="botao-primario">Nova venda</Link>
      </Cabecalho>
      <Aviso ok={sp.ok} erro={sp.erro} />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 text-sm">
        <Link href={link({ status: null, pagina: null })} className={`whitespace-nowrap rounded-full px-3 py-1 ${!status ? "bg-stone-900 text-white" : "bg-white text-stone-600"}`}>
          Todos
        </Link>
        {Object.entries(NOMES_STATUS).map(([k, nome]) => (
          <Link key={k} href={link({ status: k, pagina: null })} className={`whitespace-nowrap rounded-full px-3 py-1 ${status === k ? "bg-stone-900 text-white" : "bg-white text-stone-600"}`}>
            {nome} <span className="opacity-60">{contagem[k] ?? 0}</span>
          </Link>
        ))}
      </div>
      <Cartao>
        <form className="mb-4 flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <input name="q" defaultValue={busca} placeholder="Número, código, nome ou telefone" className="campo" />
          <button className="botao-secundario">Buscar</button>
        </form>
        {lista.length === 0 ? (
          <Vazio>Nenhum pedido encontrado.</Vazio>
        ) : (
          <Tabela>
            <thead>
              <tr>
                <th>#</th>
                <th>Data</th>
                <th>Cliente</th>
                <th>Canal</th>
                <th>Pagamento</th>
                <th>Status</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {lista.slice(0, POR_PAGINA).map(({ p, cliente }) => (
                <tr key={p.id} className="hover:bg-stone-50">
                  <td>
                    <Link href={`/admin/pedidos/${p.id}`} className="font-medium underline-offset-2 hover:underline">
                      #{p.numero}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap text-stone-500">{formatarDataHora(p.criadoEm)}</td>
                  <td>{cliente ?? "—"}</td>
                  <td>{NOMES_CANAL[p.canal]}</td>
                  <td>
                    <span className="text-stone-600">{NOMES_PAGAMENTO[p.formaPagamento]}</span>
                    {p.statusPagamento !== "pendente" && (
                      <span className="ml-1">
                        <Etiqueta valor={p.statusPagamento} texto={p.statusPagamento === "aprovado" ? "pago" : p.statusPagamento} />
                      </span>
                    )}
                  </td>
                  <td>
                    <Etiqueta valor={p.status} texto={NOMES_STATUS[p.status]} />
                  </td>
                  <td className="text-right tabular-nums">{formatarReais(p.totalCentavos)}</td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
        {(pagina > 1 || temMais) && (
          <div className="mt-4 flex justify-between text-sm">
            {pagina > 1 ? <Link href={link({ pagina: pagina - 1 })} className="underline">← Anteriores</Link> : <span />}
            {temMais && <Link href={link({ pagina: pagina + 1 })} className="underline">Mais antigos →</Link>}
          </div>
        )}
      </Cartao>
    </>
  );
}
