import Link from "next/link";
import { contexto } from "@/lib/painel";
import { resumoDaLoja, pedidosRecentes } from "@/lib/consultas";
import { cancelarPedidosVencidos } from "@/lib/pedidos";
import { resumoDoMes } from "@/lib/financeiro";
import { formatarReais } from "@/lib/dinheiro";
import { formatarDataHora, hojeSP } from "@/lib/datas";
import { NOMES_STATUS } from "@/lib/rotulos";
import { Cabecalho, Cartao, Etiqueta, Indicador, Vazio } from "@/components/admin/ui";

export default async function Inicio() {
  const { loja } = await contexto();
  // aproveita a visita para liberar o estoque dos pedidos que não foram pagos a tempo
  await cancelarPedidosVencidos();
  const [r, fin, atencao] = await Promise.all([
    resumoDaLoja(loja),
    resumoDoMes(loja.id, hojeSP().slice(0, 7)),
    pedidosRecentes(loja.id, ["aguardando_pagamento", "pago", "separacao"], 12),
  ]);

  return (
    <>
      <Cabecalho titulo={loja.nome}>
        <Link href="/admin/pedidos/novo" className="botao-primario">
          Nova venda
        </Link>
      </Cabecalho>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Vendas hoje" valor={formatarReais(r.hoje.totalCentavos)} detalhe={`${r.hoje.pedidos} pedido(s)`} />
        <Indicador rotulo="Vendas no mês" valor={formatarReais(r.mes.totalCentavos)} detalhe={`ticket médio ${formatarReais(r.ticketMedioMesCentavos)}`} />
        <Indicador rotulo="Lucro bruto no mês" valor={formatarReais(r.mes.lucroBrutoCentavos)} detalhe="vendas menos o custo das peças" />
        <Indicador rotulo="Para enviar" valor={String(r.aEnviar)} detalhe={r.aguardandoPagamento ? `+ ${r.aguardandoPagamento} aguardando pagamento` : "nenhum aguardando pagamento"} />
      </div>
      {fin.aPagar > 0 && (
        <Link href="/admin/financeiro" className="mt-3 block rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800 hover:bg-amber-100">
          {formatarReais(fin.aPagar)} em contas a pagar neste mês →
        </Link>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <Cartao titulo="Pedidos que pedem atenção">
          {atencao.length === 0 ? (
            <Vazio>Nada pendente.</Vazio>
          ) : (
            <ul className="divide-y divide-stone-100">
              {atencao.map(({ p, cliente }) => (
                <li key={p.id}>
                  <Link href={`/admin/pedidos/${p.id}`} className="flex items-center gap-3 py-2.5 text-sm hover:bg-stone-50">
                    <span className="w-12 font-medium">#{p.numero}</span>
                    <span className="min-w-0 flex-1 truncate">{cliente ?? "—"}</span>
                    <span className="hidden text-xs text-stone-500 sm:inline">{formatarDataHora(p.criadoEm)}</span>
                    <Etiqueta valor={p.status} texto={NOMES_STATUS[p.status]} />
                    <span className="w-24 text-right tabular-nums">{formatarReais(p.totalCentavos)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
        <Cartao titulo={`Estoque baixo (até ${loja.estoqueMinimo})`}>
          {r.estoqueBaixo.length === 0 ? (
            <Vazio>Estoque em dia.</Vazio>
          ) : (
            <ul className="space-y-2 text-sm">
              {r.estoqueBaixo.map((v) => (
                <li key={v.varianteId} className="flex justify-between gap-2">
                  <Link href={`/admin/produtos/${v.produtoId}`} className="truncate hover:underline">
                    {v.produto}
                    {v.variante !== "Padrão" && <span className="text-stone-500"> · {v.variante}</span>}
                  </Link>
                  <span className={`tabular-nums ${v.estoque <= 0 ? "font-semibold text-red-600" : "text-amber-700"}`}>{v.estoque}</span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>
    </>
  );
}
