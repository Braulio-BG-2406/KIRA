import { contexto } from "@/lib/painel";
import { lerPeriodo, relatorioDeVendas } from "@/lib/relatorios";
import { formatarReais } from "@/lib/dinheiro";
import { formatarData } from "@/lib/datas";
import { NOMES_CANAL, NOMES_PAGAMENTO } from "@/lib/rotulos";
import { Cabecalho, Cartao, Indicador, Tabela, Vazio } from "@/components/admin/ui";
import type { CanalVenda, FormaPagamento } from "@/db/schema";

function Barra({ valor, maximo }: { valor: number; maximo: number }) {
  return (
    <div className="h-2 w-full rounded-full bg-stone-100">
      <div className="h-2 rounded-full bg-stone-700" style={{ width: `${maximo ? Math.max(2, (valor / maximo) * 100) : 0}%` }} />
    </div>
  );
}

export default async function Relatorios({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string }> }) {
  const { loja } = await contexto();
  const sp = await searchParams;
  const periodo = lerPeriodo(sp.de, sp.ate);
  const r = await relatorioDeVendas(loja.id, periodo);
  const q = `de=${periodo.de}&ate=${periodo.ate}`;
  const maxDia = Math.max(0, ...r.porDia.map((d) => d.total));
  const maxCanal = Math.max(0, ...r.porCanal.map((d) => d.total));

  return (
    <>
      <Cabecalho titulo="Relatórios" />
      <form className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-stone-200 bg-white p-4">
        <label><span className="rotulo">De</span><input type="date" name="de" defaultValue={periodo.de} className="campo" /></label>
        <label><span className="rotulo">Até</span><input type="date" name="ate" defaultValue={periodo.ate} className="campo" /></label>
        <button className="botao-primario">Ver</button>
        <div className="ml-auto flex flex-wrap gap-2 text-sm">
          <a href={`/admin/exportar?tipo=pedidos&${q}`} className="botao-secundario">Pedidos (CSV)</a>
          <a href={`/admin/exportar?tipo=itens&${q}`} className="botao-secundario">Itens vendidos (CSV)</a>
          <a href="/admin/exportar?tipo=estoque" className="botao-secundario">Produtos e estoque (CSV)</a>
        </div>
      </form>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Faturamento" valor={formatarReais(r.total)} detalhe={`${r.pedidos} pedido(s)`} />
        <Indicador rotulo="Ticket médio" valor={formatarReais(r.ticketMedio)} />
        <Indicador rotulo="Lucro bruto" valor={formatarReais(r.lucroBruto)} detalhe={`custo ${formatarReais(r.custo)} · descontos ${formatarReais(r.descontos)}`} />
        <Indicador rotulo="Frete cobrado" valor={formatarReais(r.frete)} />
      </div>
      <p className="mt-2 text-xs text-stone-500">Pedidos cancelados ficam de fora. Período: {formatarData(periodo.de)} a {formatarData(periodo.ate)}.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Cartao titulo="Vendas por dia">
          {r.porDia.length === 0 ? <Vazio>Sem vendas no período.</Vazio> : (
            <ul className="space-y-1.5 text-sm">
              {r.porDia.map((d) => (
                <li key={d.dia} className="grid grid-cols-[80px_1fr_110px] items-center gap-3">
                  <span className="text-stone-500">{formatarData(d.dia)}</span>
                  <Barra valor={d.total} maximo={maxDia} />
                  <span className="text-right tabular-nums">{formatarReais(d.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
        <div className="space-y-6">
          <Cartao titulo="Por canal">
            {r.porCanal.length === 0 ? <Vazio>—</Vazio> : (
              <ul className="space-y-2 text-sm">
                {r.porCanal.map((c) => (
                  <li key={c.canal} className="grid grid-cols-[110px_1fr_110px] items-center gap-3">
                    <span>{NOMES_CANAL[c.canal as CanalVenda]} <span className="text-stone-400">({c.pedidos})</span></span>
                    <Barra valor={c.total} maximo={maxCanal} />
                    <span className="text-right tabular-nums">{formatarReais(c.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
          <Cartao titulo="Por forma de pagamento">
            {r.porPagamento.length === 0 ? <Vazio>—</Vazio> : (
              <ul className="space-y-1 text-sm">
                {r.porPagamento.map((c) => (
                  <li key={c.forma} className="flex justify-between">
                    <span>{NOMES_PAGAMENTO[c.forma as FormaPagamento]} <span className="text-stone-400">({c.pedidos})</span></span>
                    <span className="tabular-nums">{formatarReais(c.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        </div>
      </div>

      <Cartao titulo="Produtos mais vendidos" className="mt-6">
        {r.topProdutos.length === 0 ? <Vazio>Sem vendas no período.</Vazio> : (
          <Tabela>
            <thead><tr><th>Produto</th><th className="text-right">Qtd.</th><th className="text-right">Receita</th><th className="text-right">Lucro bruto</th><th className="text-right">Margem</th></tr></thead>
            <tbody>
              {r.topProdutos.map((p) => (
                <tr key={p.produto}>
                  <td>{p.produto}</td>
                  <td className="text-right tabular-nums">{p.quantidade}</td>
                  <td className="text-right tabular-nums">{formatarReais(p.receita)}</td>
                  <td className="text-right tabular-nums">{formatarReais(p.lucro)}</td>
                  <td className="text-right tabular-nums">{p.receita ? Math.round((p.lucro / p.receita) * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </Cartao>
    </>
  );
}
